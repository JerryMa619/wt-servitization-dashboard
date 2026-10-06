# Viva Presentation Polish and Follow-up Review

Reviewed on 6 October 2026, Europe/London, against the current WT implementation.
This is a software and presentation review, not examination approval or field validation.

## Scoped Changes

- Active calibrated RUL outputs use **Adjusted lower / P50 / Adjusted upper** in
  metrics, map popup, architecture details, ontology inspector, evidence modal
  and executed semantic tables. Compact summaries refer to **lower RUL**, not P10.
- Manual overrides, historical records and records without calibration evidence
  use **Lower / P50 / Upper**, never an unsupported active-model calibration label.
- Model descriptions retain legitimate P10/P90 references to the raw quantiles
  and percentile-based calibration method. Internal keys and exported records
  are unchanged for backwards compatibility.
- The TCS panel now explicitly labels cost allocation as illustrative, not
  measured expenditure. Item splits, service durations, repair effects and
  residual-risk allowances remain assumptions.
- Follow-up review found that the RUL trend legend still described mixed/manual
  histories as adjusted. It now uses generic lower/upper labels unless every
  plotted sample has current-model calibration provenance. A nearby scope note
  distinguishes manual/historical bounds from model uncertainty.
- A one-sample line without symbols was visually empty. Single-sample RUL plots
  now show markers at the actual lower, P50 and upper values. No new readings,
  noise, interpolation, prediction gains or economic results were introduced.

## Follow-up Assessment

No further blocking issue was found within the reviewed presentation changes.
Keep the current architecture and module layout. It is suitable for a scoped
research-prototype viva demonstration, not proof of autonomous industrial
maintenance or empirical economic benefits.

The strongest examination sequence remains:

1. Identify the research contribution and ISO-inspired responsibilities.
2. Follow a simulated condition through RUL, service selection and assumed TCS.
3. Show modeled downtime and the recorded post-service update.
4. Execute an evidence question and reject a missing-unit test copy.
5. Compare policies and explain assumptions, equal results and limitations.

Important questions to prepare:

- Automatic crack growth and reference-assisted features are not an independent
  vibration-to-crack detection experiment. Pseudo-hour targets are not measured
  blade failure times; source-window calibration is not independent-blade validation.
- RDF/SPARQL/SHACL demonstrate executable evidence structure and traceability.
  They do not infer the service policy, perform OWL reasoning or validate physical accuracy.
- The dashboard model is a calibrated demonstration implementation, not an
  unchanged reproduction of every original thesis configuration/result.
- TCS is an assumed single-intervention calculation; the comparative experiment
  is finite-horizon simulation, not a calibrated probabilistic lifecycle optimiser.
- Default RUL-only and RUL-plus-TCS results coincide, and the crack-threshold
  baseline is cheaper. Do not claim universal policy superiority.
- Repair efficacy and session/contract outcomes are simulated or fixed references,
  not measured service or contractual achievements.

Further academic improvement would come from independent measured degradation,
paired waveform/features, observed failure targets, verified costs and assessed
service outcomes. Additional decorative modules would not resolve those gaps.
Large build chunks remain a nonblocking performance maintenance item. Prepare
the local build and a screenshot/recording backup for the examination.

## Verification

- 53 named WT tests passed: model 16, XGBoost 9, ontology 6, framework 6,
  vibration 7 and research 9. The two added regression tests cover provenance-aware
  labels and mixed-history chart semantics, including single-sample markers.
- Original ontology source/schema check passed: 50 classes and 64 properties.
- Production build passed with the pre-existing large-chunk warning.
- `scripts/verify-viva-polish-ui.mjs` passed on both local WT routes: metrics,
  map, architecture, evidence modal, actual positive semantic execution,
  manual override recapture, cost disclosure, keyboard-accessible cost detail
  and 1440/390/320 px overflow checks. Single-reading plot pixels were checked.
- [Local verification](../../screenshots/viva-polish/verification.json) and
  screenshots contain isolated test scenarios only, not the user's saved session.
- Desktop and narrow-screen TCS, architecture and the single-reading RUL output
  were visually inspected. Frozen semantic evidence was deliberately recaptured
  for the manual case; preserved old evidence is not a stale-result bug.
- Two empty duplicate local dependency directories (`react 2`, `react-dom 2`)
  prevented TypeScript discovery. Removing those empty cache directories restored
  the build; no dependency manifest/lockfile, model artifact or user data changed.

Public deployment verification is recorded separately after publication.
