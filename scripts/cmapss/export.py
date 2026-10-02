"""Usage: python scripts/cmapss/export.py /path/to/CMAPSSData (requires numpy)."""
import hashlib
import json
import sys
from pathlib import Path
import numpy as np
from baseline import (units, rows_for, fit_normaliser, build_training,
                      ridge_fit, endpoint_feature, predict, RUL_CAP)

ROOT = Path(__file__).resolve().parents[2]
SELECTED = [1, 20, 34, 49, 68, 81, 90, 100]
SENSORS = [2, 3, 4, 7, 11, 12, 15]

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    source = Path(sys.argv[1])
    train = np.loadtxt(source / 'train_FD001.txt')
    test = np.loadtxt(source / 'test_FD001.txt')
    truth = np.loadtxt(source / 'RUL_FD001.txt')
    residuals = []
    for fold in range(5):
        fit = train[(train[:, 0].astype(int) % 5) != fold]
        norm = fit_normaliser(fit, 1)
        x, y = build_training(fit, norm, stride=7)
        model = ridge_fit(x, y)
        for uid in units(train):
            if uid % 5 != fold:
                continue
            r = rows_for(train, uid)
            for fraction in (.40, .55, .70, .85, .95):
                cutoff = max(5, min(len(r), int(round(len(r) * fraction))))
                point = float(predict(model, endpoint_feature(r, cutoff, norm))[0])
                actual = min(RUL_CAP, r[-1, 1] - r[cutoff - 1, 1])
                residuals.append(actual - point)
    q10, q90 = np.quantile(residuals, [.1, .9])
    norm = fit_normaliser(train, 1)
    x, y = build_training(train, norm, stride=5)
    model = ridge_fit(x, y)
    def estimate(rows, cutoff):
        p = float(predict(model, endpoint_feature(rows, cutoff, norm))[0])
        return [round(float(v), 4) for v in (np.clip(p+q10, 0, RUL_CAP), p, np.clip(p+q90, 0, RUL_CAP))]
    endpoints = np.asarray([estimate(rows_for(test, uid), len(rows_for(test, uid))) for uid in units(test)])
    engines = []
    for uid in SELECTED:
        rows = rows_for(test, uid)
        points = []
        for cutoff in range(min(30, len(rows)), len(rows)+1):
            low, point, high = estimate(rows, cutoff)
            row = rows[cutoff-1]
            points.append(dict(cycle=int(row[1]), low=low, point=point, high=high,
                               settings=row[2:5].tolist(), sensors=[float(row[4+s]) for s in SENSORS]))
        engines.append(dict(id=uid, points=points))
    # Ground truth deliberately separated from the runtime records.
    evaluation = dict(endpointRMSE=float(np.sqrt(np.mean((endpoints[:, 1]-truth)**2))),
                      coverage=float(np.mean((truth >= endpoints[:, 0]) & (truth <= endpoints[:, 2]))),
                      engines=100, cappedTrainingTarget=125,
                      truth=[dict(id=uid, finalCycle=int(rows_for(test,uid)[-1,1]), finalRUL=float(truth[uid-1])) for uid in SELECTED])
    result = dict(dataset='FD001', model='fd001-window-ridge-v1', unit='cycles',
                  sourceURL='https://www.nasa.gov/intelligent-systems-division/discovery-and-systems-health/pcoe/pcoe-data-set-repository/',
                  files={name:sha(source/name) for name in ['train_FD001.txt','test_FD001.txt','RUL_FD001.txt']},
                  exporterSHA256=sha(Path(__file__)), baselineSHA256=sha(Path(__file__).with_name('baseline.py')),
                  sensorNumbers=SENSORS, selectedEngines=SELECTED, residualQuantiles=[float(q10),float(q90)],
                  calibration='Five engine-held-out folds; fold-local normalization; empirical residual 10/90 percentiles, clipped to 0–125 cycles. Coverage is not guaranteed.',
                  engines=engines, evaluation=evaluation)
    out=ROOT/'src/cmapss/replay.json'
    out.write_text(json.dumps(result, separators=(',',':'))+'\n')
    print(json.dumps(dict(output=str(out), bytes=out.stat().st_size, points=sum(len(e['points']) for e in engines), evaluation={k:v for k,v in evaluation.items() if k!='truth'}), indent=2))

if __name__ == '__main__':
    main()
