# C-MAPSS data and model provenance

This document describes the preserved FD001 baseline. For the FD002–FD004 extension, full-test metrics and FD004 source-count discrepancy, see [MULTI_DATASET.md](MULTI_DATASET.md).

## Inputs

NASA Turbofan Engine Degradation Simulation Data Set, FD001. [Repository and citation](https://www.nasa.gov/intelligent-systems-division/discovery-and-systems-health/pcoe/pcoe-data-set-repository/).

Citation: A. Saxena, K. Goebel, D. Simon, and N. Eklund, “Damage Propagation Modeling for Aircraft Engine Run-to-Failure Simulation,” PHM 2008.

The original `train_FD001.txt`, `test_FD001.txt` and `RUL_FD001.txt` are local inputs, not included in this commit. Exact input SHA-256 hashes are embedded in `src/cmapss/replay.json`. The committed file contains numerical derivatives and selected observation channels for eight test engines: 1, 20, 34, 49, 68, 81, 90 and 100. These are illustrative identities, not a representative sample or the basis of the reported aggregate metrics. Engine 1 deliberately exercises a short trajectory.

## Reproduce

With Python 3 and NumPy installed:

```sh
python scripts/cmapss/export.py /path/to/CMAPSSData
python scripts/cmapss/test_prefix.py /path/to/CMAPSSData
npm run test:cmapss
```

Outputs contain no timestamp or private filesystem path, and are deterministic for the same inputs and numerical environment. Exporter and baseline source hashes are embedded. The browser's observation record contains all three operating settings and seven display channels (2, 3, 4, 7, 11, 12, 15). Inference uses all varying sensor channels selected from the 21 sensor columns. UI windows start at cycle 30. Engine 1 therefore has just two snapshots. Evaluation truth is stored in a separate top-level section, excluded from decision inputs and exported evidence. This separation is an application boundary, not a security measure: the browser bundle contains evaluation data.

## Baseline

`baseline.py` adapts the window/trend ridge functions from the project's Chapter 5 `cmapss_complete_analysis.py`. It uses a 30-cycle window, latest/mean/std/slope/delta sensor features, operating settings and cycle count; ridge penalty 10; training target cap 125 cycles. Training examples are sampled every five cycles. The normalizer and model use training engines only. Each test prediction is generated from a prefix ending at its displayed cycle.

Calibration uses five engine-held-out folds (engine ID modulo five), training stride seven, and held-out prefixes at 40%, 55%, 70%, 85%, 95% of trajectory length. Unlike the earlier chapter script, normalization is fitted inside each fold. The 10th and 90th residual quantiles shift the point prediction, clipped to [0,125]. These are empirical bounds, not a guarantee of conditional coverage; the point prediction is not claimed to be a calibrated median.

All 100 FD001 test endpoints, using uncapped supplied ground truth: RMSE **16.6893509242 cycles**, empirical interval coverage **78%**. No new prognostic state-of-the-art claim is made. These recalculated results can differ from archived chapter results because fold-local normalization was corrected.

## Service policy

The baseline state uses the lower bound: Nominal >80, Watch >40, Alert >15, Hold ≤15 cycles. The scenario's adjustable decision guardrail is a separate rule. If lower RUL is at or below that guardrail, only Planned Maintenance and Derate/Hold are eligible.

Actions and default (direct cost, next-review lead in cycles): Continue (0,20), Enhanced Monitoring (.05,10), Inspection (.15,5), Planned Maintenance (1,0), Derate/Hold (1.3,0). Expected normalized cost = direct cost + consequence ratio × approximate failure probability before the next review. A normal approximation uses the point estimate and sigma = max((upper−lower)/(2×1.2815515655),1). An immediate action is assigned zero waiting risk as a simplifying assumption. This is not a fitted intervention-effect model. Review-time and cost sliders are sensitivity assumptions; they never alter the observed trajectory or model prediction.

No currency, physical service execution, downtime history, measured availability, contract settlement or intervention benefit is inferred. Contract context in the graph is an illustrative assumption.

## Ontology

Reuse `public/ontology/sdt_tbox.ttl` and its parsed `src/data/ontologySchema.json`, licensed CC BY 4.0 to Jerry Ma. Schema source hashes and class/property definitions are retained. The application shows declared classes and selected instances as a UI projection, with SDT, SOSA and PROV relationship labels. Since v0.2, the separate Semantic check workbench generates actual RDF, executes SPARQL and validates the C-MAPSS application profile with SHACL Core. The overview graph remains a simplified projection; no OWL reasoning is performed.

Source RUL properties are in hours. Application evidence explicitly stores `units: cycles` and does not assert cycle values using hours properties. The v0.2 cycle-valued RDF extension and its SHACL shapes implement this adaptation without subclassing the hours-constrained source class. See [semantic workflow](SEMANTIC_WORKFLOW.md) for its exact scope. Engine observation feature-of-interest is the engine, and the schematic does not infer component fault localisation from a whole-engine prediction.
