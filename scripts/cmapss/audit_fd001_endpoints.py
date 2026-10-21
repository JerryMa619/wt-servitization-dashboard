"""Reconstruct the frozen FD001 endpoint predictions, without changing the model/replay.
Usage: python scripts/cmapss/audit_fd001_endpoints.py /path/to/CMAPSSData
The stored training-only residual quantiles are reused; no test-set tuning.
"""
import hashlib,json,sys
from pathlib import Path
import numpy as np
from baseline import units,rows_for,fit_normaliser,build_training,ridge_fit,endpoint_feature,predict,RUL_CAP
ROOT=Path(__file__).resolve().parents[2]
r=json.loads((ROOT/'src/cmapss/replay.json').read_text()); source=Path(sys.argv[1])
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for name,expected in r['files'].items():
    assert sha(source/name)==expected, f'Source hash mismatch: {name}'
assert sha(Path(__file__).with_name('baseline.py'))==r['baselineSHA256']
train,test,truth=[np.loadtxt(source/f'{k}_FD001.txt') for k in ('train','test','RUL')]
norm=fit_normaliser(train,1);x,y=build_training(train,norm,stride=5);model=ridge_fit(x,y)
q10,q90=r['residualQuantiles'];endpoints=[]
for uid in units(test):
    rows=rows_for(test,uid);p=float(predict(model,endpoint_feature(rows,len(rows),norm))[0])
    lo,p,hi=[round(float(v),4) for v in (np.clip(p+q10,0,RUL_CAP),p,np.clip(p+q90,0,RUL_CAP))]
    endpoints.append(dict(engine=uid,low=lo,point=p,high=hi,truth=float(truth[uid-1])))
for e in r['engines']:
    row=endpoints[e['id']-1];last=e['points'][-1]
    for k in ('low','point','high'):assert row[k]==last[k],(e['id'],k)
rmse=float(np.sqrt(np.mean([(e['point']-e['truth'])**2 for e in endpoints])))
coverage=sum(e['low']<=e['truth']<=e['high'] for e in endpoints)/len(endpoints)
assert abs(rmse-r['evaluation']['endpointRMSE'])<1e-10
assert coverage==r['evaluation']['coverage']
out=dict(dataset='FD001',sourceFiles=r['files'],baselineSHA256=r['baselineSHA256'],replaySHA256=sha(ROOT/'src/cmapss/replay.json'),auditSHA256=sha(Path(__file__)),method='Frozen training-only residual quantiles; same final fit; all eight replay endpoints and full-set RMSE/coverage reconciled. No test-set fitting.',endpoints=endpoints)
f=ROOT/'docs/cmapss/dataset-evidence/FD001-endpoints.json';f.write_text(json.dumps(out,indent=2)+'\n');print(f'{len(endpoints)} endpoints reconciled: RMSE={rmse}, coverage={coverage}')
