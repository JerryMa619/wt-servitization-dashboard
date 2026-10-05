# WT Research and Viva Implementation

Date: 2026-10-05. Implements the four priorities approved after the
[readiness review](../reviews/2026-10-05-viva-readiness.md), preserving the WT
model artifacts, original Chapter 4 ontology and separate C-MAPSS case.

## 1. Visible Scientific Boundaries

- WT animation is labelled **Simulated blade condition**, not independent
  crack detection. Crack originates from replay/assumed growth and assists
  construction of scenario features; there is no measured signal-to-crack detector.
- RUL values and inputs are labelled **pseudo-h**. Chart bounds are **Adjusted
  lower / P50 / Adjusted upper**, not exact conditional P10/P90 percentiles.
- Current `ch5-xgb-cqr-2.0`, synthetic target, native/browser parity fixtures and
  original model versions are unchanged. Internal source-window calibration
  does not establish field lifetime accuracy or independent-trajectory coverage.
- Single-intervention TCS is labelled assumed GBP. Risk remains a heuristic
  index, not a calibrated failure probability; confidence remains a heuristic.
- ISO mapping is an architectural research adaptation, not certification.

## 2. Executable WT Semantics

**Ontology & Decision Evidence -> Semantic Check** pauses WT simulation and
captures the selected live/historical/frozen snapshot. N3 creates actual RDF;
`rdf-validate-shacl` executes SHACL Core; Comunica executes SELECT queries.
No new semantic dependency was installed. The existing C-MAPSS mechanism is
adapted with a separate WT vocabulary and constraints.

Sources:

- `src/ontology/wtSemantic.ts`: snapshot materialisation and actual execution.
- `public/ontology/wt-profile.ttl`: local WT vocabulary description.
- `public/ontology/wt-shapes.ttl`: executed application constraints.
- `public/ontology/queries/wt-{evidence,candidates,features}.rq`: competency questions.
- `src/ontology/WtSemanticWorkbench.tsx`: controls, failure/retry, report/export.

Questions: why this recommendation; which candidates satisfy the risk filter;
which named features support the estimate. A full vector exposes 31 feature
names/values and provenance; absence of a vector yields no fabricated features.
Manual/legacy evidence is not attributed to the current model. Current model
and training-feature hashes are attached only to current non-override evidence.

The separate `wt:PseudoRULEstimate` is not declared equivalent to or a subclass
of the original physical-hours `sdt:RULEstimate`. Local vocabulary identifiers
under `https://w3id.org/sdt-wt/demo#` are names, not a claim of namespace registration.
The original Chapter 4 T-Box/SHACL files are reference downloads and unmodified.

Shapes require a root snapshot, source hash, correctly typed linked evidence,
pseudo-hour unit, nonnegative ordered bounds, nonnegative assumed candidate
cost, risk index 0..1, and an eligible selected candidate. These checks do not
prove physical accuracy, all Chapter 4 conformance, minimum-cost optimality or
OWL inference. Live Graph remains a labelled projection. The selected candidate
is materialised from the application's existing decision, not inferred by OWL.

Missing-unit and missing-estimate-link options modify temporary copies only.
Actual violations and query rows are shown. Selection changes hide stale
results; fetch/execution failures permit retry without a false success badge.
Exports include RDF, SHACL report, query/results, captured snapshot and SHA-256
hashes of snapshot/dataset/shapes. Displayed numeric cells are rounded to three
decimals; exports retain query precision. Browser computation stays local.

## 3. Comparable Service Policies

The existing TCS constants and selection functions are extracted without changing
default economics to `src/model/service.ts`; crack growth is shared from
`src/model/operating.ts`. `src/research/experiments.ts` uses the same condition
model, growth law, repair fractions, service durations and risk filter.
Execution runs in a Web Worker; changed inputs invalidate/cancel old results.

Default assumptions: 120 modeled hours, initial crack 0 mm, mean wind 8 m/s,
fixed interval 40 modeled hours and cost/efficacy multipliers 1.
At hour t, all policies receive wind
`round_0.1(base + 1.2*sin(t/12) + 0.4*sin(t/3))`, bounded to 0..40 m/s.
The UI permits mean wind 3..12 m/s. Same calendar horizon and starting condition
do not imply the same subsequent crack path: maintenance changes that path.

| Policy | Demonstration trigger |
| --- | --- |
| Fixed interval | Predictive intervention at each configured due time |
| Crack threshold | Predictive intervention at crack >=45 mm |
| RUL only | Predictive intervention at adjusted lower RUL <360 pseudo-h |
| RUL + TCS | Existing risk-filtered minimum intervention-cost choice, executed only for a repairing action when crack >=45 mm, lower RUL <360 or selected residual-risk index >0.42 |

All policies share a forced corrective intervention at the assumed 80 mm ceiling.
The baselines can start repairs rejected by the common residual-risk filter;
those events are explicitly counted as risk-filter violations, not hidden or
described as safe. Unsafe operating hours count non-downtime hours at crack
>=60 mm or lower RUL <240 pseudo-h. These thresholds are assumptions, not
validated blade safety limits. Advisory inspection/prepositioning is not executed.

### Cost Accounting

1. Direct service and net logistics charges are incurred once at service start.
2. Downtime and contract charges accrue pro rata for actual modeled downtime.
3. Repair takes effect only after completion. At the horizon, unfinished service
   retains partial downtime and no fabricated repaired state.
4. Add one terminal no-action heuristic risk allowance:
   `risk_index^2 * 9800 GBP * consequence_multiplier`.
5. Table TCS = incurred charges + terminal allowance; cost curves show incurred
   charges only. Candidate risk allowances are not charged repeatedly per repair.

Downtime multiplier scales the existing 95 GBP/h fixed downtime price, not the
lost generation term. Consequence scales the assumed risk allowance. Efficacy
scales repair reduction, clipped to 0..1, and reruns the same model on projected
post-repair crack. All direct/logistics/contract assumptions otherwise remain
unchanged. No discounting, calibrated failure-probability model, measured costs
or actual maintenance outcome is supplied. Baseline monitoring charges are
omitted equally. This finite-horizon illustration is not a lifecycle optimiser.

The default illustrative results (rounded GBP):

| Policy | Modeled TCS | Downtime h | Completed / started |
| --- | ---: | ---: | ---: |
| Fixed interval | 9186 | 16 | 2 / 2 |
| Crack threshold | 8174 | 16 | 2 / 2 |
| RUL only | 9059 | 16 | 2 / 2 |
| RUL + TCS | 9059 | 16 | 2 / 2 |

All four have zero unsafe operating hours and zero risk-filter violations in
this default example. RUL and RUL+TCS coincide; this is retained honestly.
Seven one-at-a-time cases include current assumptions and +/-25% consequence,
downtime price and efficacy (clipped to input limits, exact values exported).
Lowest modeled cost is not automatically the safest/best service policy.
Exports retain configuration, common wind, per-policy series/events, incomplete
services, accounting/scope, sensitivity outcomes, model version and source/model
hashes.

## 4. Reproducible Viva Controls

Presets: healthy 0 mm; growing 25 mm; service threshold 45 mm; high damage 65 mm.
They start paused at 8 m/s / 226 degrees with reference-assisted model features.
The top play/pause controls freeze/resume WT data, rotor animation and simulated
service time together, without fabricating a zero RPM reading. Architecture
remains visible as before. Archived raw-waveform references have their own
player and are not synchronous WT sensor evidence.

Original session is checkpointed before entering a demo. Active original work
requires confirmation and is closed as interrupted with incurred downtime.
Demo ledger is memory-only and never overwrites persisted original history.
Reset restarts the selected preset only. Return restores the original checkpoint,
manual input, ledger, stats, cursor and session ID, paused. Persisted sessions
store the latest reading, not a full chart buffer. Closing/reloading abandons
unexported demo work and reopens the original checkpoint. Demo history exports
use a distinct filename; import/clear are disabled inside demos.

Live monitor steps are 1 modeled hour per 1.4-second UI tick. Maintenance durations
are compressed into a minimum number of ticks, so **a demo tick is not always
one modeled hour**. Session stats use explicit modeled elapsed/downtime increments.
Policy comparison instead uses uniform one-modeled-hour accounting steps.
Do not compare UI playback seconds with predicted pseudo-hours as field time.

**Offline coordinate view** disables external tile requests and retains coordinate
and wind overlays, explicitly without a geographic basemap. Failed/incomplete
tiles are reported, not mistaken for a complete map. Online OSM attribution is
enabled. A prebuilt local dashboard can run without map tiles, but cold public
loading still needs networking and this is not a service-worker offline app.

## Verification and Demonstration

- `npm run test:wt:research`: nine tests cover actual valid/invalid SHACL/SPARQL,
  31 features, empty/unordered/ineligible evidence, manual/legacy provenance,
  unchanged default estimates, deterministic common scenarios, cost reconciliation,
  incomplete repair, shared ceiling and invalid ranges.
- Existing WT model/ontology/XGBoost/framework/vibration suites remain applicable.
- `npm run check:ontology` checks original source/schema consistency.
- Existing C-MAPSS baseline, semantic, contracts, datasets and story suites are
  regression checks for the unchanged separate case.
- `node scripts/verify-wt-research-ui.mjs` tests both routes, completed service,
  global pause, isolated history restoration/reload, actual semantic success and
  defects, resource failure/retry, export/hashes, 31-feature query, stale-result
  removal, four policies/seven sensitivities, invalid inputs, plotted cost-series
  pixels, coordinate fallback and 390/320 px layouts.
- Local screenshots/results: `screenshots/wt-research/`; public results use its
  `public/` subdirectory when `DASHBOARD_URL` targets GitHub Pages.
- No new tool installation or model retraining is required. Known large build
  chunks remain; semantic execution and comparison load separately on demand.

Viva sequence: start healthy and identify architecture/source limits; choose
service-threshold and play through downtime/repair; pause and inspect Decision
Trace; execute a valid semantic question followed by missing-unit rejection;
compare policies and explain the equal RUL/TCS case and sensitivity; export
evidence and return to the original session. Retain a local build/screenshots
for network failure. Approval, hardware control, paired raw/features, independent
crack detection, measured assessment and learning feedback remain future work.

### Local Verification Record

All 51 named WT tests passed: 42 existing tests and nine new research tests.
All five separate C-MAPSS assertion suites passed, including actual semantic
execution and 4835 replay snapshots across the four subsets. Original ontology
source/schema check passed (50 classes / 64 properties). Production build
passed with the existing large-chunk warnings; no dependencies were changed.

Both local routes passed the new research browser suite. Additional XGBoost,
history repair, two-cycle Framework and vibration browser suites passed. Desktop
and 390/320 px research screenshots were inspected. Plot validation counts
colored cost-series pixels, not just nontransparent background/grid pixels,
and waits for the canvas to finish resizing. The first screenshot exposed
transient animation and clipped narrow-screen axis labels; the comparison
chart now has no introductory animation, a scroll legend, centered hour label,
compact icon actions and a bounded semantic-results table. Test selectors were
corrected for uppercase CSS and the actual completed-service class; completed
services are awaited rather than accepted after a fixed delay.

Generated research records contain only isolated simulated demo data, not the
user's saved browser session. Completed demo, executed semantic evidence and
full policy comparison JSON accompany the screenshots. Public deployment
verification is recorded separately after publication.
