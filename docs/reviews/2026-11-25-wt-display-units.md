# WT display terminology update

## Request

25 November 2026: remove "pseudo" from the demo's presentation wording. Ordinary WT screens now use **model hours** in prose and **model h** in compact values/axes. The associated local five-minute Word introduction uses "synthetic model hours" and retains its field-validation caveat.

This is a presentation change only. It does not convert units, change model inputs/weights, retrain XGBoost, alter predicted numbers, repair effects, growth equations, risk thresholds or TCS calculations. Synthetic/reference-assisted evidence and lack of field lifetime validation remain explicit.

## Changes

- Updated RUL metrics, uncertainty chart subtitle/axis, turbine labels, framework details, event descriptions, input fields, conflict messages, evidence views, model-basis metrics and calibration wording.
- Updated Live Graph fields, DT Mapping / Data Records display rows, Decision Trace and Semantic Questions answer/table/test-case wording.
- Updated WT descriptions in the cross-case viva context and policy-comparison accounting note. C-MAPSS cycles and unrelated privacy terminology were not changed.
- The model-basis training target is relabelled only when displayed. Original model artifacts and their target metadata/hashes remain unchanged.
- Original Chapter 4 T-Box/SHACL and WT technical identifiers `wt:PseudoRULEstimate` / `wt:PseudoHour` remain unchanged, as do executable query/shape references. Their downloadable WT-profile descriptions now use the new human-readable wording. Raw advanced SPARQL/RDF evidence may therefore retain legacy identifier names; these are not ordinary unit labels.
- Existing browser-local history and previously downloaded evidence are not rewritten. Archived free-text descriptions or original metadata can retain the earlier terminology, preserving provenance rather than silently mutating historical evidence.
- Updated existing display-label assertions and added assertions that semantic answer prose omits the removed term while exported RDF retains its compatible unit identifier. Added `scripts/verify-wt-display-units-ui.mjs` for both WT routes.
- Updated the local Word document `VIVA Preparation/WT Dashboard Five Minute Introduction.docx`, retained its two-page layout, and rendered/visually reviewed both pages. The personal preparation file is not uploaded to this public repository.

## Verification

The browser check inspects the ordinary overview, expanded enhanced model basis, input/feature scope, Live Graph, mapping, records, trace and an executed RUL semantic answer. It verifies the displayed unit labels, unchanged held readings, numeric RUL parity, SHACL/SPARQL success, compatible RDF identifiers and dataset SHA-256. It also checks 390/320 px layouts and records generated-simulation screenshots.

The browser uses a fresh isolated context. WT ticks are accelerated only in the test, then explicitly paused after a completed simulated intervention for stable wording screenshots. The script does not submit a manual scenario or modify production timing.

```sh
npm run check:ontology
npm run test:wt:lineage
npm run test:wt:questions
npm run build
DASHBOARD_URL=http://127.0.0.1:5173/ node scripts/verify-wt-display-units-ui.mjs
```

Use the existing `PLAYWRIGHT_MODULE` / `CHROME_EXECUTABLE` environment variables when needed. Production preview can use the script default `http://127.0.0.1:4173/wt-servitization-dashboard/`; public checks use `DASHBOARD_URL=https://jerryma619.github.io/wt-servitization-dashboard/`. Receipts are written under `screenshots/wt-display-units/` and its `public/` subfolder. Final check and deployment outcomes are appended after completion.

Local browser verification passed on standard and enhanced routes, including a completed simulated service before inspection, all listed presentation surfaces, unchanged captured readings, real SHACL/SPARQL execution, numeric answer parity, legacy RDF unit identifiers, export hash and desktop/390/320 px layouts. No page runtime errors were reported. [Local receipt](../../screenshots/wt-display-units/verification.json). Desktop input, semantic-answer and mobile screenshots were visually reviewed.

A source comparison confirmed no changes in `src/data/`, `src/model/`, original Chapter 4 ontology files, WT executable shapes, RDF generation, fixed SPARQL templates or the dependency lockfile. Local model/type checking and the complete script sweep were also started; their outcomes and GitHub deployment are recorded below after completion.

## Completed publication

- Application commit: [`998ee10cac093b0d2f74928db8de5d29c48c9d9a`](https://github.com/JerryMa619/wt-servitization-dashboard/commit/998ee10cac093b0d2f74928db8de5d29c48c9d9a).
- GitHub Pages [run 45634464347](https://github.com/JerryMa619/wt-servitization-dashboard/actions/runs/45634464347) succeeded: ontology source check, all 15 repository test commands, TypeScript/production build and deployment. Job-step conclusions were checked explicitly. Two initial status requests returned HTTP 500; a direct retry confirmed completed/success, not a deployment failure.
- [Public browser verification](../../screenshots/wt-display-units/public/verification.json) passed both standard and enhanced routes. It inspected all presentation surfaces listed above, completed a simulated service, verified unchanged held readings, executed RUL queries/SHACL and checked RDF/export hashes and responsive layouts. No page runtime errors. Public input/semantic screenshots and the mobile semantic layout were visually checked.
- The local full sweep reported passes for the ontology check, ontology tests, CMAPSS replay checks and twin tests, then remained waiting in the CMAPSS semantic command. The local TypeScript stage completed and Vite entered transformation, but the production bundle did not finish promptly. These duplicate local jobs were deliberately terminated after the same application commit passed the complete GitHub checks/build and local/public browser checks. The local aggregate printed a generic FAIL on termination; it was not a completed assertion failure. Do not describe the local full sweep/build as passed.
- The local Word introduction was regenerated with "synthetic model hours", rendered and visually reviewed on both pages. Spoken text remains approximately five minutes with demonstration pauses (553 words). No personal document, live GPS or browser service history was uploaded.
- Final evidence-only documentation/screenshots are committed with `[skip ci]`; they do not alter the already verified deployed application. Local development remains at `http://127.0.0.1:5173/` and `http://127.0.0.1:5173/enhanced/`.
