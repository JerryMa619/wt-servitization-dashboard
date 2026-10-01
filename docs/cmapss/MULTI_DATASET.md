# Four-subset replay (v0.4)

## Purpose and interaction

The dashboard now supports FD001–FD004 in the existing DT framework, ontology and service-decision views. Select **Dataset** in replay controls or select a subset in **Twin overview → Four subsets, separate models**. Every subset has eight replay engines. Changing the subset resets engine/cycle, playback, evaluation truth, named contract and policy assumptions. FD001's existing guided Engine 034 and cost/margin examples are preserved; those examples are deliberately not relabelled as trajectories from other subsets.

The measurement object is each subset's full set of test endpoints. Primary comparison metrics are endpoint RMSE (cycles) and empirical interval coverage (fraction). Train/test counts and operating-condition/fault-mode counts provide context. The eight-engine replay is a bounded detail view, not a representative fleet sample. No measured availability, financial benefit or intervention outcome is added.

| Subset | Operating conditions / fault modes | Actual train / test engines | Replayed snapshots | Endpoint RMSE, cycles | Interval coverage |
| --- | --- | --- | --- | --- | --- |
| FD001 | 1 / 1 | 100 / 100 | 1,233 | 16.6894 | 78.00% |
| FD002 | 6 / 1 | 260 / 259 | 1,023 | 28.9442 | 67.18% |
| FD003 | 1 / 2 | 100 / 100 | 1,225 | 17.8612 | 69.00% |
| FD004 | 6 / 2 | 249 / 248 | 1,354 | 30.8724 | 61.29% |

These are **separately fitted models within each subset**, not a cross-dataset transfer experiment or a causal estimate of the effect of complexity. The lower coverage in the added subsets makes the present baseline's uncertainty limitations visible. Service recommendations still use the same illustrative cost and guardrail rules; they are not validated operational aviation advice.

## Original sources and a readme discrepancy

Original inputs are the local `CMAPSSData/train_FD00x.txt`, `test_FD00x.txt` and `RUL_FD00x.txt` from the project's Chapter 3 data folder. Their SHA-256 hashes accompany each replay. The NASA source link remains in the UI. Original text files are not copied into this repository.

The bundled `readme.txt` defines FD001/FD002 as HPC-degradation scenarios and FD003/FD004 as HPC-plus-fan-degradation scenarios, with one or six operating conditions. This does not identify a fault on any particular engine or diagnose a component from its replay.

The bundled readme lists FD004 as 248 training / 249 test trajectories. **Actual file contents are 249 training / 248 test trajectories**, with test IDs 1–248 and 248 RUL labels. The local test and RUL files were compared byte-for-byte with `CMAPSSData.zip` and are identical:

- `test_FD004.txt`: `1dc675fff0624bac10786927c6715b37d1297657137400d2b1a3138d777a3ba5`
- `RUL_FD004.txt`: `196b836b85a95ac7fdbbf29c5fdf1657382eafa445644d114ffaaf50dc2975e1`

All denominators and UI counts use actual file contents. `dataset-evidence/source-verification.json` records raw-file hashes, engine counts and exact agreement of every displayed setting/sensor observation with its source row.

## Model and calibration

`baseline.py` and the published FD001 artifact are unchanged. `export_subsets.py` fits a separate ridge baseline per new subset, using the same 30-cycle prefix window, latest/mean/std/trend/delta features, current operating settings and cycle feature, regularization 10 and 125-cycle capped training target.

For FD002/FD004, six clusters of standardized operating settings are learned from training engines only. Sensor normalization is fitted within those clusters. FD003 uses one condition. Test rows are assigned to the nearest fitted center; there is no fitting on test observations. Cluster IDs are algorithmic groups, not labelled physical flight regimes.

Calibration uses five held-out engine folds (`engine_id % 5`), with every normalizer fitted on that fold's training engines. Held-out training trajectories contribute prefixes at 40%, 55%, 70%, 85% and 95% of their observed run-to-failure length. Fold models use stride 7; final models use stride 5. This matches the original export protocol. Residual 10th/90th percentiles produce bounds clipped to 0–125 cycles. These empirical bounds are not conformal or guaranteed 80% intervals; the cost model's normal approximation remains illustrative.

Final test evaluation compares rounded exported endpoint predictions against **uncapped** RUL labels. RMSE is `sqrt(mean((prediction − truth)^2))`; coverage is the fraction satisfying `lower ≤ truth ≤ upper`. Training/calibration targets remain capped, which affects comparisons with long test RULs. Endpoint metrics do not summarize every replay cycle. No model or threshold was selected using test performance.

For new subsets, eight engine IDs are selected by evenly spaced index over sorted test IDs, before inspecting prediction quality. Prefix-mutation/truncation checks verify that future sensor observations cannot alter features at an earlier cutoff. Export validation rejects nonfinite values, unordered cycles and truth-count mismatches. Runtime records contain observations and predictions; evaluation truth is kept in a separate field and is not used by the decision or RDF generator.

## Identity and loading

Asset identity is `urn:cmapss:FD00x:engine:n`; engine 1 in two subsets is two different assets. Model identifiers, source-file names/hashes, JSON IDs and download names include the selected subset. RDF generation rejects a mismatched dataset/model prefix or missing source hashes. The unchanged application profile 0.3.0 continues to validate the same cycle-valued structure across all subsets; the application version is 0.4.

FD001 is bundled as before. Other compact replay JSON files load on demand and must match the manifest's SHA-256 hash. The UI handles loading, HTTP failures, integrity failures, retries and cancelled requests. It does not leave old evidence visible as the new selection's evidence. Semantic results are invalidated when the selection changes.

## Reproduce and audit

```sh
python scripts/cmapss/export_subsets.py /path/to/CMAPSSData
python scripts/cmapss/verify_sources.py /path/to/CMAPSSData
node --experimental-strip-types scripts/test-cmapss-datasets.mjs --record
npm run build
```

Python requires NumPy. The raw source files stay local. `dataset-evidence/FD00x-endpoints.json` records all endpoint predictions and evaluation labels for independent metric recomputation; these audit files are not runtime inputs. `src/cmapss/datasets.json` records subset counts, metrics and replay hashes. CI verifies all 4,835 replay snapshots, hashes, metrics, 32 asset identities, real SPARQL/SHACL and configured-contract validation.

Browser test:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs CHROME_EXECUTABLE=/path/to/chrome node scripts/verify-cmapss-datasets-ui.mjs
```

`DASHBOARD_URL` optionally selects a production-preview base. It checks all three new subsets, resets, actual semantic execution, dataset-aware downloads, cancellation, failure/retry, integrity checking, FD001 examples and 390/320px layouts. Records and screenshots are under `screenshots/cmapss-datasets/`.
