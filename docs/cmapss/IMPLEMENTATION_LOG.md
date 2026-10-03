# C-MAPSS v1 implementation record

Tracking: https://github.com/JerryMa619/wt-servitization-dashboard/issues/1

## 2026-10-01 — scope and design

- Request: build a first interactive C-MAPSS servitization DT demonstration, including the DT framework and ontology, and record the work in GitHub.
- Isolated branch `codex/cmapss-v1` from `5d2a939`; the existing wind-turbine checkout has unrelated in-progress changes and is untouched.
- New `/cmapss/` route. Four coordinated views share the selected FD001 engine and cycle: twin, framework, ontology and service decisions.
- Reuse Chapter 5's window/trend ridge baseline and Chapter 4's published ontology snapshot. Predictions use only the selected cycle's prefix; training and calibration use training engines only. Fit normalization independently inside each calibration fold.
- First version uses eight explicitly listed test engines, with evaluation across all 100 FD001 test endpoints. No claimed FD002–FD004 support yet.
- RUL remains in cycles. Runtime cycle estimates are a UI projection and are not asserted into the source ontology's hours-valued properties.
- Service costs and rules are demonstrator assumptions, not commercial aviation estimates. No live physical connection, measured intervention response, OWL reasoning or SHACL execution is claimed.
- Only public-source derivatives, code and implementation evidence are included. No private thesis documents or original raw-data archive are committed.

## Planned verification

Deterministic data generation; prefix-only feature test; source hashes; action safety-gate and scenario tests; production build; browser replay, engine selection, framework, ontology, export, mobile and original-route checks. Outcomes will be appended after execution.

## 2026-10-01 — implementation and first validation

- Implemented the independent route, eight-engine causal replay (1,233 snapshots), architecture module inspection, ontology instance/schema/evidence views and five-action scenario comparison.
- Added source/model hashes, explicit cycles, evaluation-only truth, downloadable immutable evidence and source TTL. Schema shows declared parents and direct property domain/range definitions.
- Model validation: all 100 test endpoints RMSE 16.6893509242 cycles; empirical nominal-80% interval coverage 78%. Selection of eight display engines does not affect these aggregate metrics.
- Passed 1,233-record model checks at five consequence ratios, state boundaries, guardrail exclusions, recommendation sensitivity, export immutability and truth isolation. Passed Python future-row mutation/prefix truncation check.
- Passed source-schema verification and the existing ontology tests; production build passed. Existing shared JS bundle still exceeds Vite's advisory 500 kB threshold; C-MAPSS code/data is lazy-loaded separately (~213 kB before gzip).
- Browser checks passed: play/pause/seek, evaluation toggle, framework selection, ontology node selection and schema search, source download, evidence JSON, guardrail and cost changes, reset, short trajectory auto-stop, 390/320 px layouts, original standard/enhanced routes; zero browser errors.
- Visual QA fixed inherited wind-turbine heading colours and moved relationship labels into the selected-node inspector to avoid overlaps.
- Created draft PR #2; retained Issue #1 as the request/design record. Added a PR/branch verification workflow and the C-MAPSS path to future Pages builds. No main-branch deployment performed.
- Concurrent wind-turbine work reached main during implementation (`2eada16`); integrate it before final verification so the PR preserves that work.

## 2026-10-01 — final integration and handoff

- Integrated `origin/main` at `2eada16`. Resolved only the concurrent script/workflow additions by preserving both `test:twin` and `test:cmapss`; no existing twin feature was removed.
- Re-ran both ontology and twin suites (10 tests), C-MAPSS model checks and production build after integration: passed.
- Re-ran the complete browser verification against the production preview at `/wt-servitization-dashboard/cmapss/`: passed, including original routes and zero browser errors. `screenshots/cmapss/verification.json` records the production test base.
- GitHub PR-triggered CI passed for implementation/integration commit `c12549c`: https://github.com/JerryMa619/wt-servitization-dashboard/actions/runs/36933819574
- Local first-review URL: http://127.0.0.1:5178/cmapss/ . Draft PR: https://github.com/JerryMa619/wt-servitization-dashboard/pull/2 . The user can review locally; no merge or public Pages release is claimed.
- Final handoff commit changes documentation, the verification URL and dependency-link ignore handling only.

## 2026-10-01 — guided demonstration and executable semantics (v0.2)

- User approved steps 1–2: a complete Engine 034 demonstration and executable ontology processing, with GitHub recording.
- Added data-derived first-entry milestones: Nominal 30, Watch 94, Alert 158, Hold 181. Each guide selection restores baseline assumptions and opens the relevant view. Text distinguishes a service-state change from a change in advisory action.
- Added an explicit cycle RUL class/profile rather than subclassing the source hours-constrained RULEstimate. Preserved the original T-Box and shapes. The application profile does not claim full source-ontology conformance.
- Implemented actual in-browser RDF generation (N3), SPARQL SELECT (Comunica 5.4.1), SHACL Core (rdf-validate-shacl 0.6.5), positive/negative examples, Turtle/query/report/results downloads and dataset/shapes hashes. Library execution is lazy-loaded.
- Added source-file, baseline/exporter and source-ontology hash provenance. Reference cycle 181 snapshot contains 136 triples. Test truth never enters the RDF. Window provenance references the raw-file range; seven endpoint display observations are materialized.
- Results become stale immediately when the engine/cycle/scenario/query/test changes. Running pauses replay. Failed test copies are clearly separated from the original observation and advice.
- Semantic tests passed: four guide stages, all eight endpoint engines, three queries, scenario identity, RDF roundtrip, unchanged source ontology, forbidden hours and truth isolation. Missing unit/evidence/source hash/policy, empty graph, missing observation provenance and inverted bounds fail as expected.
- Browser checks passed on development preview: guide navigation, actual library execution, four downloads, both negative examples, three query result sets, stale-result invalidation, scenario reset and 390/320px layouts; zero page errors. Initial browser attempt required restarting Vite after replacing the shared dependency link with isolated installed dependencies; the retry passed.
- Applied compatible npm dependency patches. Existing ECharts 5.x moderate advisory requires a separate major-version upgrade; no semantic-library advisory remains. Build passes with existing large-bundle warnings plus the lazy semantic engine chunk.
- See SEMANTIC_WORKFLOW.md, semantic-evidence/ and screenshots/cmapss-semantic/ for reproducible details and evidence. Production/regression verification follows below.

### v0.2 final production verification

- Production build and `/wt-servitization-dashboard/cmapss/` verification passed. Both semantic-workflow and original C-MAPSS browser suites passed with zero page errors, including original standard/enhanced wind-turbine route checks.
- Verified desktop and 390/320px layouts for both conforming and invalid RDF cases; screenshot evidence has been refreshed for v0.2.
- Source ontology verification, all ten existing ontology/twin tests and all 1,233-record advisory checks passed. The semantic suite is now required in both branch/PR checks and future Pages builds.
- Implementation commit: `aeeff2b`. Local preview remains http://127.0.0.1:5178/cmapss/ . User review is through draft PR #2; no main merge or Pages publication was performed.

## 2026-10-01 — contract scenario comparison (v0.3)

- Continued the agreed next step: two named, explicitly assumed service contracts compared at fixed engine/cycle/RUL evidence.
- Added Maintenance support (consequence 5, margin 15) and Availability assurance (consequence 20, margin 25); all other model inputs remain shared. Example buttons derive the first cost-driven difference at cycle 158 and intervention-margin difference at cycle 171 from Engine 034's actual snapshots.
- Added an explicit cycle-opportunity KPI budget: 200 scheduled slots, 95%/99% targets, 5/20 planned/unplanned assumed losses. The planned loss fits the first budget but exceeds the second by 3 slots. This is not measured time availability; the KPI budget does not feed the optimizer or claim compliance.
- Applying a named contract updates the current policy, summary, ontology details, RDF and JSON exports. Manual policy changes/reset/guide selection detach it. Fixed comparison cards always use their declared presets.
- Profile 0.3.0 adds optional configured-contract and budget instances, a fourth SPARQL query, SHACL fields and cross-node contract/policy equality constraints. The generator rejects named-policy mismatch; recommendation identity includes contract/KPI assumptions, while estimate identity stays unchanged.
- Model/semantic tests passed for all 1,233 fixed-evidence comparisons, known example choices, KPI arithmetic/bounds, snapshot export detachment, real query values and SHACL rejection of mutated policy/missing target. Original model/semantic suites, source ontology check and ten ontology/twin tests also passed.
- Browser verification covers applying contracts without changing RUL, both exports, actual query/validation, policy detachment, and desktop/mobile layouts. An initial test locator was corrected to recognize the already-applied button state on a second mobile iteration.
- Design and reproduction are in CONTRACT_SCENARIOS.md. Contract RDF and reports are under contract-evidence/. Final production verification and screenshots follow.

### v0.3 final production verification

- Production build passed. All three browser suites passed against `/wt-servitization-dashboard/`, with zero browser errors: contract comparison, executable semantics and original C-MAPSS regressions including standard/enhanced wind-turbine routes.
- Verified desktop and 390/320px contract comparison and semantic result layouts. Refreshed screenshots and machine-readable verification records are committed with this handoff.
- Implementation commit: `b2b1717`. Contract comparison remains an explicit research scenario; capacity budgets are hypothetical and do not establish measured availability or contractual compliance.
- Local review: http://127.0.0.1:5178/cmapss/ . GitHub review remains draft PR #2; no merge or public deployment was performed.

## 2026-10-02 — four-subset replay (v0.4)

- Continued the planned FD002–FD004 extension. Preserved the FD001 replay, baseline and guide; added separate subset fits using fold-local, training-only operating-condition normalization.
- Added on-demand replay loading with SHA-256 verification, dataset selector, full-test endpoint comparison, reset/cancellation/error/retry handling and scoped operating/fault-mode context.
- Dataset identity now flows through assets, model/source provenance, charts, contract comparisons, JSON exports, RDF and semantic result downloads. Source ontology and SHACL profile are unchanged.
- Audited the readme discrepancy: FD004 actual files contain 249 train / 248 test engines; local test/RUL bytes match the original ZIP. Counts and evaluation use the actual files.
- All 4,835 snapshots passed model/contract checks; 32 endpoints passed real SPARQL/SHACL with exact dataset/source identities. Every new subset's configured contract passed. Independent raw-source checks verified all displayed observations and labels. All endpoint metrics can be recomputed from committed evaluation audit files.
- Original FD001 model, semantic and contract tests, ontology verification and ten ontology/twin tests passed. Production build passed with the pre-existing large-bundle warning.
- See MULTI_DATASET.md for methodology, actual counts, interpretation, provenance and reproduction. Final browser verification is recorded below.

### v0.4 final production verification

- All four browser suites passed at the production preview base `/wt-servitization-dashboard/`, with zero page errors. Existing standard/enhanced routes and FD001 guide/contract/semantic checks remain intact.
- New tests cover all added subsets, dataset-aware JSON/RDF/results downloads, policy/evaluation/playback reset, cancellation, HTTP failure/retry and corrupted-artifact rejection/retry. An initial test-handler cleanup race was corrected by allowing the deliberately delayed interception to finish before removing it; no application error was involved.
- Desktop and 390/320px layouts passed. Visual review prompted wider mobile dataset/engine controls; the affected multi-dataset and original browser suites were rerun successfully after the CSS change.
- Implementation commit: `7b387e2`. Final documentation and screenshots follow in the handoff commit. Local URL remains http://127.0.0.1:5178/cmapss/ . Draft PR #2 remains unmerged and no public deployment was performed.

### Integration with concurrent main updates

- Final-head push CI passed for `d618653`: https://github.com/JerryMa619/wt-servitization-dashboard/actions/runs/36939878971 . PR-triggered runs were unavailable because main had advanced with the wind-turbine repair work through `d9d47da`.
- Merged that main history into the working branch, preserving the wind-turbine repairs and all C-MAPSS work. Resolved only package-script and TypeScript-option ordering conflicts by retaining both sides' settings. Added the incoming 11-test dashboard model suite to C-MAPSS branch/PR CI.
- After integration, the 11 model tests, ten ontology/twin tests, all 4,835-snapshot dataset tests and production build passed. Multi-dataset and original C-MAPSS production browser suites also passed with zero page errors, including both original route smoke checks. No main merge or deployment was performed by this task.

## 2026-10-02 — requested public web release

- User requested an online webpage, authorizing publication through the existing GitHub Pages site.
- Integrated main through e3c6e98, retaining the latest turbine instrumentation, XGBoost and vibration work. Resolved package-script and ignore-list conflicts by preserving both sets of entries.
- All source-ontology, turbine, model, XGBoost, vibration and C-MAPSS model/semantic/contract/dataset checks passed before release. Branch CI now also includes XGBoost and vibration checks.
- Intended public entry: https://jerryma619.github.io/wt-servitization-dashboard/cmapss/ . Deployment and online verification will be recorded in the GitHub issue/PR after completion.

## 2026-10-03 — automatic case-study story (v0.5)

- User requested a full automatic animated explanation of the case, practical meaning, contributions and framework/ontology collaboration.
- Added a nine-scene, approximately three-minute Chinese walkthrough with real FD001 Engine 034 records, causal prediction frames, two controlled contract examples, framework/ontology mapping and a contribution/limitation conclusion.
- Semantic scenes execute actual RDF/SHACL/SPARQL. The broken-copy scene removes the cycle unit and expects a genuine violation. Automatic progress waits for execution; errors pause and permit retry.
- Added playback speed, pause/resume/restart, manual chapters, background pause, reduced-motion support, readable transcript, direct `?story=1` entry and export of actual session checks with hashes. Exiting restores the explorer; physical actions and benefits remain unasserted.
- Methodology, narrative and precise contribution scope: ANIMATED_STORY.md. Validation results follow below.

### v0.5 final local verification

- The complete nine-scene automatic sequence passed against the production preview, including all four executed semantic checks, known contract decisions, completion, pause/resume/restart, chapter selection and evidence export with hashes.
- Browser checks passed for direct `?story=1` entry, Escape exit, preserved explorer snapshot, failed shape-file fetch/retry, reduced motion and 390/320px layouts; zero page errors.
- Visual QA corrected the play-button contrast and placed narration, evidence and collaboration alongside one another on wide screens. Final screenshots disable CSS transitions during capture; the full automatic sequence was rerun successfully after the changes.
- Existing original and four-subset explorer browser suites were rerun successfully, including standard/enhanced wind-turbine route smoke checks. Dataset/semantic/contract suites and the new player tests passed. Build passed with existing bundle-size warnings.
- Implementation commit: `184d45a`. PR #3 records this update; publication verification will be recorded there after deployment.
