# Chapter 5 XGBoost Integration

Historical baseline record. The subsequent owner request to improve P10/P50/P90 is implemented as `ch5-xgb-cqr-2.0`; see [responsive calibration record](CALIBRATED_XGBOOST.md). The original artifacts and results below are preserved, not relabelled as the new model. The baseline training script now writes its browser representation under `models/chapter5/browser-artifact.json` rather than overwriting the active calibrated browser engine.

## Owner Decision

On 2026-10-02 the owner requested replacement of the dashboard's heuristic RUL calculation with Chapter 5 XGBoost. After inspecting reproduced wide quantiles, the owner selected **strictly preserve the original configuration and show its limitations**, not an initialisation repair. The default intercept, objectives and hyperparameters are preserved. The exploratory alternative was not deployed and did not modify Chapter 5 sources.

## Source and Training

Canonical local sources: Chapter 5 `run_pipeline.py` and `outputs/features.csv`. The original source only persisted metrics, not fitted models. This work therefore refits new deployable models using that protocol; it cannot claim binary identity with an unavailable historical model.

Committed source snapshot, data, full official XGBoost JSON model exports and provenance are in [`models/chapter5/`](../../models/chapter5/). SHA-256 fingerprints and dependency versions are in [manifest.json](../../models/chapter5/manifest.json). Raw model files can be loaded by XGBoost `load_model`; the compact browser artifact is an inference representation, not a Python training checkpoint. See [official model-IO documentation](https://xgboost.readthedocs.io/en/release_3.0.0/tutorials/saving_model.html) and [quantile-regression example](https://xgboost.readthedocs.io/en/release_3.0.0/python/examples/quantile_regression.html).

- 315 rows, 31 features; labels excluded, no wind-bin standardisation for RUL (matching the source main pipeline).
- Three `XGBRegressor`s: alpha 0.1/0.5/0.9; 300 trees, depth 6, learning rate 0.05, seed 42, `reg:quantileerror`, verbosity 0. No other hyperparameter/intercept change.
- The original `train_rul_xgboost` evaluation function is called unchanged: stratified five-fold CV. All rows are then used to fit deployable models, separately from validation.
- Target: `1000*(1-crack_mm/80)`. Units are controlled pseudo-hours, not validated physical blade life. Shared damage-state sessions and synthetic labels limit the inference that can be made from CV metrics.

| Reproduced Original CV Metric | Result |
| --- | ---: |
| RMSE | 76.66 pseudo-h |
| MAE | 49.65 pseudo-h |
| PHM score | 443.71 |
| Alpha-lambda (20%) | 0.8571 |
| PICP (nominal P10-P90) | 0.9905 |
| MPIW | 785.71 pseudo-h |

The high coverage is accompanied by very wide intervals; it is not evidence of precise or field-calibrated uncertainty. On the supplied deployed windows P90 is effectively 1000 and P10 is often 0..250. Original-policy early intervention is a disclosed consequence. No cost/risk thresholds were retuned to mask it.

## Application Integration

- Full feature windows: replay uses the corresponding 31 raw extracted features; Input Scenario accepts a named feature JSON object or `{ "features": { ... } }`. Every feature must be finite and present. Partial or oversized inputs are rejected.
- Reference-assisted scenarios: interpolation of the 21 C0-C6 / wind-bin mean feature templates supplies unavailable features for simulated growth, basic manual input and assumed repairs. Explicit measured-field edits update the appropriate features/ratios. These inputs are labelled reference-assisted, not measured.
- Existing crack visualisation remains a supplied/simulated condition context. Importing a feature window does not create a measured crack observation or train a new crack classifier. GPS/direction do not enter the RUL model.
- Display envelope: integer rounding, nonnegative 0..1000 clipping and min/max enclosure around P50. Raw Python-equivalent outputs and adjustment flag are retained. No probability calibration is implied.
- Source modes distinguish replay, imported window, reference assistance and manual RUL override. Manual RUL edits do not claim XGBoost output.
- Reopening an imported snapshot preserves its full feature vector. GPS/direction-only edits retain its model outputs; changing a model/scenario input explicitly switches to reference assistance. A browser regression checks this context/edit boundary.
- Actual post-repair and TCS projected RUL use the same model/adapter; inspection or prepositioning does not change RUL when no damage reduction is assumed. A rise in lower-tail RUL is not guaranteed by this original model.
- Model version, input vector, raw quantiles, adjustment flag and out-of-training feature names persist with event evidence. Existing historical numbers are not relabelled or recalculated. Imported feature snapshots hold the manual simulation clock.

## Reproduction

Local Python environment `.venv-xgboost/` is ignored by Git. Installed XGBoost 3.0.2, scikit-learn 1.7.2 and their runtime dependencies; macOS additionally needed Homebrew `libomp` for native XGBoost. No running website requires Python, Homebrew or an inference server.

```sh
python3 -m venv .venv-xgboost
.venv-xgboost/bin/python -m pip install -r scripts/requirements-xgboost.txt
.venv-xgboost/bin/python scripts/train-chapter5-xgboost.py --snapshot
npm ci
npm run test:xgboost
npm run test:model
npm run test:ontology
npm run test:twin
npm run build
```

The training script defaults to the project's original Chapter 5 sources if present, otherwise the committed snapshot. `--snapshot` makes portable reproduction explicit. Training does not regenerate thesis results, modify original datasets/documents, or tune the model. JSON feature windows can be downloaded from the Input Scenario disclosure; the download is a template/current vector, not a new measurement.

## Verification Record

Native/browser parity covers all 315 supplied windows plus an all-missing vector: 948 quantile comparisons, maximum absolute error **0** on the recorded fixtures. See [parity result](../../models/chapter5/browser-parity.json). Source/model hashes, label exclusion, strict parameters, input rejection, raw-output preservation, domain warnings, manual override and TCS/inspection consistency are tested.

Implementation findings retained in the record: decimal JSON thresholds must be converted back to float32 before branch comparisons; otherwise values exactly at a native threshold can enter the wrong branch. Training-domain comparisons use the same float32 representation to avoid false out-of-domain warnings at supplied range boundaries. Nominal quantile ordering/clipping is separate from the model and exposes its raw output rather than silently changing the estimator.

Local checks passed: all 31 regression tests (5 XGBoost, 14 model, 6 ontology, 6 framework), source-ontology check (50 classes / 64 properties), build, named-feature import/invalid-input rejection and persistence on both routes, desktop/mobile layout, full animation/replay/reduced-motion checks, history/interruption/freshness checks, and two full services per route with continuous visible Framework flow. The committed-snapshot training command was also rerun successfully. Browser screenshots were visually inspected. The empty-replay fallback is also routed through XGBoost, not the old heuristic formula; the added regression covers that path.

Evidence: [XGBoost browser checks](../../screenshots/xgboost/verification.json), [two-cycle continuity](../../screenshots/framework/verification.json), [regression workflow](../../screenshots/fixes/verification.json). Implementation commit [`102bfb0`](https://github.com/JerryMa619/wt-servitization-dashboard/commit/102bfb0) passed [Pages deployment 36959450273](https://github.com/JerryMa619/wt-servitization-dashboard/actions/runs/36959450273). Both public routes then passed feature-window inference, invalid-input rejection, raw-output persistence, model-limit disclosure, ontology mapping, reload and desktop/mobile checks: [public verification](../../screenshots/xgboost/public/verification.json). Follow-up commit includes the checked empty-replay fallback and public evidence. The larger initial JS bundle (approximately 1.3 MB / 357 KB gzip) is a known tradeoff of including the trained models and replay vectors for offline/static-site inference; Vite retains its >500 KB chunk warning.
