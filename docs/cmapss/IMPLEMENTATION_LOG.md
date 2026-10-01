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
