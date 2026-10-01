# Dashboard Audit Repairs

Date: 2026-10-01/02. Baseline: `2babd4f`. Requested by the project owner after the [audit](../reviews/2026-10-01-dashboard-audit.md). No new physical accuracy or ISO conformance claim.

## Completed Implementation

- [x] Highest severity across crack, vibration/kurtosis and RUL; monotonicity and low-RUL tests.
- [x] Clear old frozen frames on event changes; pin matching execution/frame; keep original proposal inputs separate from repaired observations.
- [x] Explicit manual/reload interruption, partial downtime accounting, no fabricated repair or completion count.
- [x] Shared RPM/power and condition/RUL models for manual, automatic and repair paths; remove artificial RUL bonuses and obsolete adjustment parameters.
- [x] Session availability from its own observation horizon/ledger; fixed Chapter 5 references separated; avoided downtime not claimed without a counterfactual.
- [x] Observation/receipt timestamps and independently refreshed freshness checks; manual/replay/VC1/VC2 marked context.
- [x] Stable 860 x 580 internally scrollable architecture; all-node containment and UE reachability tests after resizing.
- [x] Model version, heuristic scores, uncalibrated uncertainty and assumptions exposed.
- [x] Single-field input bounds and related-field conflicts, including GPS validation.
- [x] Missing ontology evidence explicitly unavailable, not substituted by Asset.
- [x] Local persistence of 30 events, latest state, held scenario and full-horizon totals; validated JSON import/export and clearing. Invalid stored data is not silently overwritten; storage failure requests export.
- [x] Deferred chart renderer with only required line/gauge components. Initial bundle approximately 1,735 KB / 536 KB gzip -> 692 KB / 191 KB gzip; deferred chart chunk 523 KB / 175 KB gzip. Existing large-chunk warning remains.

## Verification

- `test:ontology`: 5 passed; `test:twin`: 5 passed; `test:model`: 11 new regression cases passed, including actual TCS repair projections and KPI reference scope.
- `verify-twin-ui.mjs`: animation, architecture/ontology navigation, automatic completion, replay, reduced motion and screenshot pixels.
- `verify-fixes-ui.mjs`: bounds, zero wind, interruption/held clock, export/reload/import rejection, missing evidence, resizing to mobile, model/KPI scope, cross-event frames, pinned/pruned evidence, stale observations and lazy chart canvas pixels.
- Isolated browser tabs accelerate only simulation ticks; normal application timing is unchanged. Evidence: `screenshots/fixes/`, `screenshots/twin/`.
- Public verification is recorded after Actions deployment in `screenshots/fixes/publication.json`.

## Remaining Boundaries

No calibrated fracture model, live sensor/actuator, human approval record, measured maintenance efficacy, counterfactual benefit calculation, OWL reasoner or live SHACL validation is added. Local storage is origin-specific, not a server work-order database. Clearing browser data loses history unless exported. The latest 30 events are retained, but totals cover the full saved simulation horizon. See [model basis](../model/MODEL_BASIS.md).
