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
