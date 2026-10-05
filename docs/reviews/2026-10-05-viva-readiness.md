# Dashboard Completeness and Viva Readiness

## Assessment

Reviewed on 2026-10-05, Europe/London. The primary WT audit covers implementation commit `e3c6e98`; a subsequent remote update at `a7286df` adds the C-MAPSS case examined separately below. All incoming changes were preserved. The dashboard is suitable for a **simulation-based research prototype demonstration with explicit caveats**. It demonstrates an architecture and traceable service workflow, not validated physical crack detection, field hours-to-failure, maintenance efficacy, lifetime cost savings or ISO conformity. This assessment concerns the software case study, not whether the entire thesis satisfies examination requirements. No production code, model parameters or original Chapter 5 sources were changed during this review.

## WT Functional Coverage

| Area | Implemented | Remaining boundary |
| --- | --- | --- |
| Asset and instrumentation | WT animation, GPS/map, named sensor reference and three-axis trends | No WT hardware ingestion; browser GPS is not asset telemetry |
| Condition and prediction | Simulated crack progression, XGBoost inference, adjusted interval, feature import and provenance | No independent signal-to-crack estimator or measured failure-time target |
| Service decision | State/risk policy, candidate costs, risk-filtered minimum-cost selection | Assumed intervention/economic coefficients and single-intervention horizon |
| Execution and update | Modeled downtime, partial interruption accounting, repair update and event replay | No physical actuation, human approval or measured outcome validation |
| Architecture and semantics | OME/DCDCE/DTE/UE/CSE mapping, source schema, projected instance graph and evidence export | Mapping is not conformity; projection is not live SHACL/OWL execution |
| Reporting and reproducibility | Session availability, separate dataset KPI, history import/export and versioned models | Browser-local bounded ledger, no matched policy counterfactual or cumulative lifecycle TCS |

The operational simulation closes the loop: scenario/replay -> features -> RUL/state -> service choice -> modeled downtime -> post-service scenario -> next monitoring cycle. A measured validation/learning loop is not implemented. Current graph flow highlights workflow state; it is not a distributed-system execution trace.

## Prioritised Findings

### High Academic Risk: Detection and RUL Claims

`src/App.tsx:1559` supplies crack length from replay and an assumed growth law, then calls `conditionPrediction`. `src/model/xgboost.ts:60` constructs reference-assisted scenario features from wind speed and crack length. Crack length is not directly an XGBoost feature, but the automatic scenario is therefore not an independent vibration-to-crack detection experiment. It cannot demonstrate detector sensitivity, false alarms or detection lead time.

The target is `1000 * (1 - crack_mm/80)` synthetic pseudo-hours. Train/calibration/test are disjoint source windows, not independent blade trajectories. Internal RMSE 72.12 pseudo-h and coverage 57/63 do not establish field accuracy. Preserve this distinction when discussing full-feature inference versus automatic scenarios. Current `ch5-xgb-cqr-2.0` differs from the original Chapter 5 configuration by the explicit initial prediction and outward calibration; explain the version and changes in any thesis/demo comparison.

Before viva: make visible labels consistent. Main surfaces still use `Blade crack detection` and `h` (`src/App.tsx:963`, `src/App.tsx:1014`, `src/twin/model.ts:62`) while detailed evidence correctly says simulated/reference-assisted and pseudo-hours. Prefer simulated blade condition, RUL pseudo-h, and adjusted lower/P50/upper bounds. P10/P90 adjusted bounds are not exact conditional percentiles; heuristic scores are not accuracy probabilities.

### High Evidence Gap: Servitization Economics

`src/App.tsx:1634` selects the lowest modeled TCS among candidates passing the residual-risk rule; `src/App.tsx:1673` estimates one intervention using assumed costs, durations, repair fractions and a heuristic squared risk allowance. This is decision support under assumptions, not a lifecycle optimiser or calibrated expected failure cost. The session ledger tracks time/services but does not accumulate a comparable lifecycle economic outcome.

Highest-value extension: run identical, documented exogenous scenarios for fixed-interval, threshold/reactive, RUL-only and RUL-plus-TCS policies. Define a common horizon, starting state, cost basis, service-induced damage evolution and risk constraints. Compare cumulative cost, downtime, service count and risk violations. Add sensitivity analysis for failure consequence, downtime price, repair efficacy and interval assumptions. Simulated comparisons remain simulated evidence, not proven actual savings.

### Medium Evidence Gap: Ontology and ISO Mapping

The parsed T-Box and graph are traceable and useful, but `src/ontology/model.ts:102` constructs a dashboard projection. Live SHACL validation and OWL reasoning are not executed. Rule decisions are computed by application functions rather than inferred by the displayed ontology. Do not describe the graph as a reasoning engine.

For an ontology-focused PhD demonstration, add at least one inspectable competency question, a real RDF instance export and an executed SHACL validation example (valid case plus deliberately invalid case). If the thesis claims semantic reasoning or interoperability, validate those claims directly rather than relying on graph aesthetics. Map each research module to the relevant ISO entity/function and distinguish research extensions from standard requirements. ISO 23247-2 is a manufacturing reference architecture; explain the research adaptation to WT servitization, without claiming conformity from layout alone.

### Medium Source Gap: Waveform and Feature Synchronisation

The current archive contains 21 simulated references. Metadata lists 315 acquisitions but only 210 CSVs are available, and archived full-waveform features differ from the committed feature snapshot. These limitations are disclosed in [the vibration record](../model/VIBRATION_DISPLAY.md). The waveform is not synchronised raw evidence for the current RUL result. A real sensor-to-feature-to-model demonstration needs acquisition IDs, shared timestamps, versioned extraction and paired raw/features, not an animation relabelled as live.

### Medium Demonstration Risk: Reproducibility and Network Dependence

Existing event replay and JSON import/export already support a controlled walkthrough. Add preset viva cases, an explicit whole-simulation pause/reset and a documented starting snapshot to avoid browser history determining the demonstration. Explain UI time versus modeled hours. Keep a tested local production build and an exported completed event available. The map uses external OpenStreetMap tiles (`src/App.tsx:831`), so local hosting alone is not full offline support. Provide an explicit map-unavailable state or permitted offline alternative, plus a short backup recording. Do not assume public Wi-Fi or GitHub Pages availability during examination.

The WT application chunk remains approximately 1.47 MB raw / 398 kB gzip; chart code is separately loaded. Further code splitting is useful but lower priority than academic evidence and controlled demonstrations.

## Latest C-MAPSS Extension

The latest remote main also includes `/cmapss/` and a direct nine-scene walkthrough at `/cmapss/?story=1`. This is a separate engine-degradation case, not WT validation. Its exported predictions use a window/trend ridge baseline, not the WT XGBoost engine. NASA C-MAPSS is a public degradation **simulation** benchmark; it does not add physical WT measurements.

Unlike the WT projection, `src/cmapss/semantic.ts` generates real RDF and executes SPARQL and SHACL Core. Unit-removal and evidence-link-removal counterexamples are validated by the actual library. This checks the C-MAPSS application profile, not all original Chapter 4 constraints, OWL inference, physical accuracy or ISO conformity. The controlled contracts keep observed sensor data and RUL fixed while changing assumed responsibility, costs and guardrails. This is particularly useful for explaining the distinction between prognosis and servitization advice. The nine-scene player has pause/restart, fixed Engine 034 evidence, validation waiting/retry and downloadable check records.

Consequently, executable semantics and a guided walkthrough are **not globally absent from the repository**. The highest-value WT improvement is to adapt those existing patterns to WT evidence, with appropriate pseudo-hour units and source boundaries, rather than build another unrelated viewer. C-MAPSS contract comparisons are already implemented; multi-policy lifecycle TCS/downtime evaluation is still a separate gap. The C-MAPSS application does not execute interventions or claim observed service outcomes.

The four subsets have separately fitted models, not a cross-asset transfer validation. Full-test interval coverages are 78.0%, 67.2%, 69.0% and 61.3%; therefore uncertainty reliability is itself a limitation worth discussing. These numbers do not validate WT intervals. See [data/model scope](../cmapss/DATA.md), [multi-dataset protocol](../cmapss/MULTI_DATASET.md), [executed semantic workflow](../cmapss/SEMANTIC_WORKFLOW.md) and [animated narrative](../cmapss/ANIMATED_STORY.md).

## Verification Performed Today

- 42 tests passed: operating/history 15, XGBoost 8, ontology 6, Framework 6 and vibration 7.
- `npm run check:ontology` verified the generated schema against source: 50 classes and 64 properties. This is source consistency, not live SHACL validation.
- `npm run build` passed; the known large-chunk warning remains.
- Both public routes returned HTTP 200 and passed history-toolbar, responsive architecture reachability and lazy-chart checks; enhanced scope/KPI disclosures also passed. [Evidence](../../screenshots/fixes/publication.json).
- Both public routes completed two services in isolated accelerated test tabs, retaining all 12 architecture modules and animated flow, then resumed the rotor. Desktop/mobile UE controls remained reachable. [Evidence](../../screenshots/framework/public/verification.json), [desktop screenshot](../../screenshots/framework/public/enhanced-after-two-cycles.png).
- Browser acceleration affects test tabs only; normal simulation timing and application source are unchanged. The rendered enhanced two-cycle screenshot was visually inspected.
- XGBoost regression checks validate committed native/browser parity fixtures and reported test metrics. No new physical experiment, external model evaluation, raw-data recollection or actual intervention was conducted today.
- After preserving the remote C-MAPSS merge, all five C-MAPSS suites passed: baseline replay, executable semantics, contract comparisons, four datasets and the story player. They cover 4835 exported snapshots / 32 displayed assets, actual positive/negative SHACL and SPARQL outcomes, contract arithmetic and player lifecycle. These assertion scripts are additional to the 42 named WT tests, not counted as extra individual tests.
- Existing lockfile dependencies were synchronised with `npm ci`; no package configuration changed. The combined production build passed. Existing large-chunk warnings and one moderate dependency advisory remain; no forced major-version upgrade was made as part of an audit.
- The complete nine-scene C-MAPSS player also passed against the public deployment: four actual semantic checks including invalid-unit rejection, actual contract examples, evidence download, pause/restart, failure/retry, direct entry/exit, reduced motion and 390/320 px layouts. No browser exceptions were recorded. [Public evidence](../../screenshots/cmapss-story/verification.json). The rendered semantic scene was visually inspected.

## Suggested Viva Walkthrough

1. State the research contribution and scope: ontology-based DT servitization integration, simulated case study, no connected WT hardware.
2. Show the ISO-inspired architecture and identify where research extensions sit.
3. Inspect a source-labelled observation and RUL input/output, distinguishing reference-assisted scenario features from imported full windows.
4. Compare service candidates, their cost items and risk constraints; explain why a cheaper candidate may be rejected.
5. Replay a completed intervention through recorded pre-service, downtime and post-service snapshots.
6. Follow its ontology provenance and export the evidence; close with limitations and the validation still required.

Priorities before viva: honest visible labels and thesis/model-version alignment; fixed local walkthrough and backup; policy comparison/sensitivity evidence; executed semantic validation if central to the thesis claim. Real hardware is not necessary to demonstrate software integration, but real-world efficacy claims require real-world evidence.

Whether a live demonstration is appropriate should be agreed through the supervisor and the institution's examination arrangements. [UCL guidance](https://www.ucl.ac.uk/study/doctoral-school/regulations/essential-procedures-and-policies/viva-examinations-guidance) is a general example: it emphasises understanding, critical analysis and awareness of limitations; it is not assumed to be this candidate's governing regulation. [ISO 23247-2 official scope](https://www.iso.org/standard/78743.html) describes the manufacturing reference architecture. The readiness judgement above is an implementation review, not examination approval or certification.
