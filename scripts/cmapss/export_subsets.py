"""Export FD002–FD004 with the same baseline; preserve the published FD001 artifact.
Usage: python scripts/cmapss/export_subsets.py /path/to/CMAPSSData
"""
import json
import sys
from pathlib import Path
import numpy as np
from baseline import units, rows_for, fit_normaliser, build_training, ridge_fit, endpoint_feature, predict, RUL_CAP
from export import sha, ROOT, SENSORS

SOURCE = Path(sys.argv[1])
CONFIG = {'FD001': (1, 1), 'FD002': (6, 1), 'FD003': (1, 2), 'FD004': (6, 2)}

def load(name):
    a = np.loadtxt(SOURCE/name)
    assert np.isfinite(a).all(), name
    if name.startswith(('train_', 'test_')):
        assert a.shape[1] == 26, name
        for uid in units(a):
            r = rows_for(a,uid)
            np.testing.assert_array_equal(r[:,1], np.arange(1,len(r)+1))
    return a

def export(dataset, conditions, faults):
    train, test, truth = [load(f'{kind}_{dataset}.txt') for kind in ('train','test','RUL')]
    ids = units(test)
    assert ids == list(range(1,len(truth)+1))
    selected = [ids[int(i)] for i in np.linspace(0,len(ids)-1,8)]
    residuals = []
    for fold in range(5):
        fit = train[(train[:,0].astype(int)%5)!=fold]
        norm = fit_normaliser(fit,conditions)
        assert all(np.isfinite(v).all() for v in norm.values())
        x,y = build_training(fit,norm,stride=7)
        model = ridge_fit(x,y)
        for uid in units(train):
            if uid%5 != fold: continue
            r = rows_for(train,uid)
            for fraction in (.40,.55,.70,.85,.95):
                cutoff=max(5,min(len(r),int(round(len(r)*fraction))))
                p=float(predict(model,endpoint_feature(r,cutoff,norm))[0])
                residuals.append(min(RUL_CAP,r[-1,1]-r[cutoff-1,1])-p)
        print(f'{dataset}: calibration fold {fold+1}/5',flush=True)
    q10,q90=np.quantile(residuals,[.1,.9])
    assert q10<=0<=q90
    norm=fit_normaliser(train,conditions)
    assert all(np.isfinite(v).all() for v in norm.values())
    x,y=build_training(train,norm,stride=5)
    model=ridge_fit(x,y)
    def estimate(r,cutoff):
        p=float(predict(model,endpoint_feature(r,cutoff,norm))[0])
        return [round(float(v),4) for v in (np.clip(p+q10,0,RUL_CAP),p,np.clip(p+q90,0,RUL_CAP))]
    endpoints=np.array([estimate(rows_for(test,uid),len(rows_for(test,uid))) for uid in ids])
    engines=[]
    for uid in selected:
        r=rows_for(test,uid)
        cutoff=min(80,len(r))
        mutated=r.copy(); mutated[cutoff:,2:]=1e8
        np.testing.assert_array_equal(endpoint_feature(r,cutoff,norm),endpoint_feature(mutated,cutoff,norm))
        np.testing.assert_array_equal(endpoint_feature(r,cutoff,norm),endpoint_feature(r[:cutoff],cutoff,norm))
        points=[]
        for cutoff in range(min(30,len(r)),len(r)+1):
            low,point,high=estimate(r,cutoff); row=r[cutoff-1]
            points.append(dict(cycle=int(row[1]),low=low,point=point,high=high,settings=row[2:5].tolist(),sensors=[float(row[4+s]) for s in SENSORS]))
        engines.append(dict(id=uid,points=points))
    evaluation=dict(endpointRMSE=float(np.sqrt(np.mean((endpoints[:,1]-truth)**2))),coverage=float(np.mean((truth>=endpoints[:,0])&(truth<=endpoints[:,2]))),engines=len(ids),cappedTrainingTarget=125,
        truth=[dict(id=uid,finalCycle=int(rows_for(test,uid)[-1,1]),finalRUL=float(truth[uid-1])) for uid in selected])
    result=dict(dataset=dataset,model=f'{dataset.lower()}-window-ridge-v1',unit='cycles',
        sourceURL='https://www.nasa.gov/intelligent-systems-division/discovery-and-systems-health/pcoe/pcoe-data-set-repository/',
        files={f'{kind}_{dataset}.txt':sha(SOURCE/f'{kind}_{dataset}.txt') for kind in ('train','test','RUL')},
        exporterSHA256=sha(Path(__file__)),baselineSHA256=sha(Path(__file__).with_name('baseline.py')),
        sensorNumbers=SENSORS,selectedEngines=selected,residualQuantiles=[float(q10),float(q90)],
        calibration='Five engine-held-out folds; fold-local normalization; empirical residual 10/90 percentiles, clipped to 0–125 cycles. Coverage is not guaranteed.',
        engines=engines,evaluation=evaluation)
    out=ROOT/f'public/cmapss/data/{dataset}.json';out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(result,separators=(',',':'),allow_nan=False)+'\n')
    audit=ROOT/'docs/cmapss/dataset-evidence';audit.mkdir(parents=True,exist_ok=True)
    (audit/f'{dataset}-endpoints.json').write_text(json.dumps(dict(dataset=dataset,sourceFiles=result['files'],exporterSHA256=result['exporterSHA256'],baselineSHA256=result['baselineSHA256'],prefixMutationChecks=len(selected),endpoints=[dict(engine=uid,low=float(values[0]),point=float(values[1]),high=float(values[2]),truth=float(actual)) for uid,values,actual in zip(ids,endpoints,truth)]),indent=2)+'\n')
    print(json.dumps(dict(dataset=dataset,points=sum(len(e['points']) for e in engines),evaluation={k:v for k,v in evaluation.items() if k!='truth'})),flush=True)
    return result

manifest=[]
for dataset,(conditions,faults) in CONFIG.items():
    r=json.loads((ROOT/'src/cmapss/replay.json').read_text()) if dataset=='FD001' else export(dataset,conditions,faults)
    train=load(f'train_{dataset}.txt'); test=load(f'test_{dataset}.txt')
    manifest.append(dict(dataset=dataset,conditions=conditions,faultModes=faults,trainEngines=len(units(train)),testEngines=len(units(test)),trainRows=len(train),testRows=len(test),displayEngines=len(r['engines']),
        model=r['model'],endpointRMSE=r['evaluation']['endpointRMSE'],coverage=r['evaluation']['coverage'],
        replaySHA256=sha(ROOT/'src/cmapss/replay.json' if dataset=='FD001' else ROOT/f'public/cmapss/data/{dataset}.json')))
(ROOT/'src/cmapss/datasets.json').write_text(json.dumps(manifest,indent=2)+'\n')
