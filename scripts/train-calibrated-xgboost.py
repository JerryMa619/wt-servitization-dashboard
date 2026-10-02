"""Train a responsive quantile model with disjoint window-level calibration/test sets."""
import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd
import sklearn
import xgboost as xgb
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'models/chapter5'
OUT = ROOT / 'models/chapter5-calibrated'
OUT.mkdir(parents=True, exist_ok=True)
baseline = json.loads((BASE / 'manifest.json').read_text())
df = pd.read_csv(BASE / 'features.csv')
features = baseline['featureNames']
X = df[features].to_numpy(dtype=np.float32)
y = df.rul_h.to_numpy()
assert len(features) == 31 and not {'state', 'crack_mm', 'wind_bin', 'rul_h'} & set(features)
assert np.isfinite(X).all() and np.isfinite(y).all()
assert np.allclose(y, 1000 * (1 - df.crack_mm.to_numpy() / 80))
assert hashlib.sha256((BASE / 'features.csv').read_bytes()).hexdigest() == baseline['sourceHashes']['features.csv']
strata = df.state + '/' + df.wind_bin
train, rest = train_test_split(np.arange(len(df)), test_size=.4, stratify=strata, random_state=42)
cal, test = train_test_split(rest, test_size=.5, stratify=strata.iloc[rest], random_state=43)
assert not (set(train) & set(cal) or set(train) & set(test) or set(cal) & set(test))
params = dict(baseline['parameters'], base_score=500)
keys = ['p10', 'p50', 'p90']
models, hashes, predictions = {}, {}, {}
probes = np.concatenate([X, np.full((1, len(features)), np.nan, dtype=np.float32)])
original = []
for key, alpha in zip(keys, [.1, .5, .9]):
    model = xgb.XGBRegressor(**params, quantile_alpha=alpha).fit(X[train], y[train])
    path = OUT / f'{key}.json'
    model.save_model(path)
    hashes[key] = hashlib.sha256(path.read_bytes()).hexdigest()
    saved = json.loads(path.read_text())['learner']
    trees = saved['gradient_booster']['model']['trees']
    assert len(trees) == 300 and all(not any(t['split_type']) for t in trees)
    models[key] = {
        'baseScore': float(saved['learner_model_param']['base_score']),
        'trees': [{k: t[k] for k in ('left_children', 'right_children', 'split_indices', 'split_conditions', 'default_left')} for t in trees]
    }
    predictions[key] = model.predict(probes).tolist()
    original.append(xgb.XGBRegressor(**baseline['parameters'], quantile_alpha=alpha)
                    .fit(X[train], y[train]).predict(X))

raw = np.column_stack([predictions[k][:-1] for k in keys])
bounded = np.clip(raw, 0, 1000)
lower, upper = bounded.min(axis=1), bounded.max(axis=1)
# Nonnegative CQR-style scores widen only; calibration never trains or retunes the trees.
scores = np.maximum.reduce([lower[cal] - y[cal], y[cal] - upper[cal], np.zeros(len(cal))])
rank = int(np.ceil((len(cal) + 1) * .8))
radius = float(np.sort(scores)[rank - 1])

def display_bounds(p, correction=0):
    values = np.clip(p, 0, 1000)
    return np.column_stack([np.maximum(0, values.min(axis=1) - correction), values[:, 1],
                            np.minimum(1000, values.max(axis=1) + correction)])

def metrics(p):
    return {'rmse': float(np.sqrt(np.mean((p[:, 1] - y[test]) ** 2))),
            'mae': float(np.mean(np.abs(p[:, 1] - y[test]))),
            'picp': float(np.mean((p[:, 0] <= y[test]) & (y[test] <= p[:, 2]))),
            'mpiw': float(np.mean(p[:, 2] - p[:, 0]))}

evaluation = metrics(display_bounds(raw, radius)[test])
original_raw = np.column_stack(original)
comparison = {'originalSameSplit': metrics(display_bounds(original_raw)[test]),
              'responsiveUncalibrated': metrics(display_bounds(raw)[test]),
              'responsiveCalibrated': evaluation}
references = []
for (crack, wind_bin), group in df.iloc[train].groupby(['crack_mm', 'wind_bin'], sort=True):
    references.append({'crackMm': float(crack), 'windSpeed': float(group.wind_mean.mean()),
                       'windBin': wind_bin, 'values': group[features].mean().tolist()})
manifest = {
    'version': 'ch5-xgb-cqr-2.0', 'name': 'Chapter 5 responsive XGBoost / window-calibrated envelope',
    'objective': params['objective'], 'parameters': params, 'quantiles': [.1, .5, .9],
    'featureNames': features, 'rows': len(df), 'trainingRows': len(train), 'evaluation': evaluation,
    'evaluationScope': '63 held-out source windows; not independent-blade or field lifetime validation',
    'target': baseline['target'], 'sourceHashes': baseline['sourceHashes'], 'modelHashes': hashes,
    'runtime': {'xgboost': xgb.__version__, 'scikit-learn': sklearn.__version__,
                'numpy': np.__version__, 'pandas': pd.__version__},
    'featureRanges': [{'min': float(df.iloc[train][c].min()), 'max': float(df.iloc[train][c].max())} for c in features],
    'referenceScope': 'Training-only state/wind-bin mean interpolation; not measured observations',
    'calibration': {'method': 'Nonnegative split-CQR-style envelope', 'nominalCoverage': .8,
                    'radius': radius, 'rows': len(cal), 'rank': rank,
                    'scope': 'Window-level empirical calibration; no field/trajectory coverage guarantee',
                    'boundMeaning': 'P10/P90-based adjusted bounds, not exact calibrated percentiles'},
    'split': {'train': train.tolist(), 'calibration': cal.tolist(), 'test': test.tolist(),
              'stratification': 'state / wind_bin', 'seeds': [42, 43]},
    'baselineVersion': baseline['version'], 'comparison': comparison,
    'diagnostics': {'roundedDistinctRawOutputs': {k: int(len(np.unique(np.round(raw[:, i])))) for i, k in enumerate(keys)},
                    'rawCrossingCount': int(np.sum((raw[:, 0] > raw[:, 1]) | (raw[:, 1] > raw[:, 2])))}
}
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
(OUT / 'calibration.json').write_text(json.dumps({'indices': cal.tolist(), 'scores': scores.tolist(),
                                                 'rank': rank, 'radius': radius}, indent=2) + '\n')
fixtures = {'vectors': [[None if not np.isfinite(v) else float(v) for v in row] for row in probes],
            'predictions': predictions, 'targets': y.tolist(), 'tolerance': .001}
(OUT / 'python-parity.json').write_text(json.dumps(fixtures, separators=(',', ':'), allow_nan=False) + '\n')
payload = {'manifest': manifest, 'references': references, 'replayVectors': X.tolist(), 'models': models}
(ROOT / 'src/data/chapter5Xgboost.ts').write_text('// Generated by scripts/train-calibrated-xgboost.py; do not edit manually.\nexport default ' + json.dumps(payload, separators=(',', ':'), allow_nan=False) + ';\n')
print(json.dumps({'version': manifest['version'], 'split': [len(train), len(cal), len(test)],
                  'radius': radius, 'comparison': comparison, 'diagnostics': manifest['diagnostics']}, indent=2))
