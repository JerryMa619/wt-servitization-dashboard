# Responsive Quantiles and Window-Level Calibration

## Owner Request and Scope

On 2026-10-02 the owner requested more realistic P10/P50/P90 after observing flat tails. This supersedes the earlier request to preserve the original configuration as the active engine. The baseline remains untouched in `models/chapter5/`; the new engine/version is `ch5-xgb-cqr-2.0` in `models/chapter5-calibrated/`.

This improves responsiveness and internally measured interval quality, not physical validity. No real run-to-failure records have been supplied. The existing seven crack-derived targets remain `1000 * (1 - crack_mm/80)` synthetic pseudo-hours. Labels are never inputs. No noise is injected, no new labels are manufactured, and no random per-frame uncertainty is used.

## Diagnosis and Model Change

Native baseline inference on all 315 supplied windows showed P10 approximately 250 for C0-C5 and 0 for C6. P90 was exactly 1000: all 300 trees had no splits and zero increments. P50 had much richer responses. This is not a chart refresh failure.

The only explicit tree-configuration change is `base_score=500`, the midpoint of the defined 0..1000 target domain. Keep original `reg:quantileerror`, three alpha values 0.1/0.5/0.9, 300 trees, depth 6, learning rate 0.05, seed 42 and XGBoost 3.0.2. The intercept repair was considered before this implementation; it was not chosen by searching test results. See [official intercept documentation](https://xgboost.readthedocs.io/en/release_3.0.0/tutorials/intercept.html).

## Separation and Calibration

Use deterministic state/wind-bin stratification: 189 training, 63 calibration, 63 test windows (9/3/3 per source cell; split seeds 42 and 43). Train all trees only on the 189 training rows. Reference templates and feature-domain ranges also use training rows only. Deployment does not refit on all rows after calibration. Original-configuration comparison models use exactly the same training and test indices, rather than comparing five-fold baseline metrics to a different test protocol.

The dataset has no blade/session/run identifiers. These are repeated source-window splits, not independent-asset or chronological trajectory splits. Test results are internal development evidence, not untouched external validation; do not claim a formal coverage guarantee on dependent field observations or on reference-assisted scenarios.

For each raw model output, clip to the known synthetic 0..1000 domain. Let `L=min(P10,P50,P90)` and `U=max(P10,P50,P90)` retain the central estimate inside the envelope. Raw values/crossing flags are saved. On calibration rows compute:

```text
score = max(L - target, target - U, 0)
rank = ceil((63 + 1) * 0.80) = 52
q = sorted(scores)[rank - 1] = 76.3111572265625
lower = max(0, L - q)
upper = min(1000, U + q)
```

This nonnegative CQR-style correction widens only; it does not shrink bounds to manufacture apparent precision. It adapts interval location/width through the learned trees, with a common outward calibration correction. The method is motivated by [Conformalized Quantile Regression](https://proceedings.neurips.cc/paper_files/paper/2019/hash/5103c3584b063c431bd1268e9b5e76fb-Abstract.html); formal exchangeability requirements are not established by this dataset. Raw independent quantiles can cross, as the [XGBoost example](https://xgboost.readthedocs.io/en/release_3.0.0/python/examples/quantile_regression.html) notes.

P10/P90 displayed labels denote **adjusted percentile-based lower/upper bounds**, not exact calibrated conditional quantiles. Round the lower bound down and upper up, and P50 to the nearest integer. This avoids narrowing due to integer display. No curve smoothing is applied that could draw crossings not present in the actual points.

## Same-Test Results

Metrics below use the unrounded bounded envelope on 63 test rows, never train/calibration rows. Rounding outward cannot decrease displayed coverage.

| Model | P50 RMSE | P50 MAE | Interval Coverage | Mean Width |
| --- | ---: | ---: | ---: | ---: |
| Original configuration / same split | 76.80 | 52.20 | 100.00% | 787.55 |
| Responsive / before calibration | 72.12 | 44.17 | 60.32% | 174.00 |
| Responsive / calibrated | 72.12 | 44.17 | 90.48% | 303.85 |

Units are pseudo-hours. Coverage is 57/63 versus nominal 80%, not a model-confidence score. Narrow raw bounds under-cover, which is why calibration is retained despite making them wider. Small sample size, seven discrete labels and repeated source windows limit any precision/generalisation claim.

Across 315 supplied feature vectors, rounded raw P10/P50/P90 have 138/142/134 distinct outputs; they are no longer constant. Raw crossings remain on 130 vectors, are ordered only for the envelope and remain disclosed in evidence. Constant or clipped tails can still occur locally, including at target-domain endpoints; no artificial movement is imposed.

## Dashboard and Evidence

- Replay, full feature imports, reference scenarios, repairs and projected TCS share the new adapter and correction.
- Cost/risk/service thresholds, growth and repair assumptions are unchanged. Updated service choices follow new predictions, not changed thresholds.
- Evidence retains exact raw outputs, envelope-adjustment flag, correction radius, nominal coverage and source-window/reference-only/out-of-domain scope.
- Reference-only and out-of-domain scenarios receive the same arithmetic correction, but explicitly have no validated coverage. GPS/direction remain context only.
- Manual RUL overrides remove calibration evidence and remain assumptions. Old immutable service records keep original values/versions. Only the active old-model snapshot is recomputed when a complete feature vector exists, excluding manual overrides.
- Model-basis details compare both configurations on the same test split and explain field/independence limitations. Ontology and Framework panels distinguish raw percentiles from adjusted bounds.

## Reproduce and Verify

Use the existing `.venv-xgboost` dependencies in `scripts/requirements-xgboost.txt` (macOS native XGBoost needs `libomp`).

```sh
.venv-xgboost/bin/python scripts/train-calibrated-xgboost.py
npm run test:xgboost
npm run test:model
npm run test:ontology
npm run test:twin
npm run build
```

Model hashes, source hashes, split indices, native parity fixtures and calibration scores/rank are committed. The baseline training command writes a baseline browser JSON separately and cannot overwrite the active model. A final all-data refit would invalidate this calibration record and is deliberately not performed.

Automated checks verify native/browser parity, unchanged baseline hashes, disjoint splits, calibration-score/rank reproduction, test metric reproduction, responsive deterministic outputs, raw/corrected evidence, imports, manual/legacy history and common repair/TCS behavior. UI checks cover both routes and desktop/mobile input, provenance and layout; evidence is in `screenshots/xgboost/verification.json`.

Local verification passed: all 35 tests (8 XGBoost / 15 operating-history / 6 ontology / 6 Framework), TypeScript/Vite production build, both-route feature-window imports, rejected malformed inputs, calibration evidence persistence and mobile/desktop layout. Both routes completed two automatic services with continuous Framework flow and resumed rotor motion (`screenshots/framework/verification.json`). History interruption/import, cross-event evidence, freshness and chart-canvas checks also passed (`screenshots/fixes/verification.json`). Native/browser raw-inference parity is zero error on 948 comparisons. Production JS remains approximately 1.47 MB / 394 KB gzip; the existing >500 KB bundle warning is retained.

To establish realistic physical RUL, the next required evidence is timestamped degradation trajectories and actual failure/censoring endpoints, identified by blade/run, followed by grouped chronological validation and an independent calibration set. Synthetic-window success cannot replace that step.
