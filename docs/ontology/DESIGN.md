# Ontology & Decision Evidence: first version

## Purpose and placement

Expose the semantic meaning and traceability of blade condition, RUL and servitization decisions within the existing dashboard. A full-width, unframed section appears immediately below the WT operation/service decision area on both standard and enhanced routes. The former enhanced-only ontology step list is replaced.

## Views

| View | Source | Interaction |
| --- | --- | --- |
| Live Graph | Current dashboard reading and existing TCS/risk selection | Entity details, incident relation labels, neighborhood focus, zoom/pan, freeze, event selection, JSON download |
| Ontology Schema | Parsed Chapter 4 T-Box snapshot | Search 50 classes, collapse module groups, follow direct SDT superclasses, inspect declared domains/ranges, download TTL |
| Decision Trace | Automatic simulator start and completion events | Select event, inspect frozen pre-service recommendation and before/after metrics, view its graph |

Graph positions remain fixed across telemetry updates. Selected incident relationships are labelled; other edges are subdued. Mobile initially selects the neighborhood view and stacks the inspector beneath the graph. Class groupings are a UI index; actual superclass declarations appear separately. External upper ontology references are displayed as identifiers declared in the source, without claiming an imported/reasoned complete BFO/IOF hierarchy.

## Sources and reproducibility

- T-Box and SHACL snapshot: sibling `servitization-digital-twin-ontology` repository, source commit `6ce0dd5bd6aec9e37f45152a102f2973d8ad3adf` at inspection. License: CC BY 4.0, Jerry Ma. SHA-256 of the actual copied T-Box is embedded in the generated schema and downloads.
- Schema metrics: 50 native classes, 38 native object properties, 26 native datatype properties. Shape count is parsed from the supplied SHACL document.
- Runtime readings: existing `src/data/dashboardData.json`, manual scenario model and automatic simulation. `source` is surfaced in the inspector.
- RUL and service state: shared `wt-demo-2.0` scenario model and highest-severity policy; version supplied but calibrated uncertainty/accuracy not supplied. See [model basis](../model/MODEL_BASIS.md).
- Recommendation: existing `serviceDecisionByTcs` output, including residual-risk filtering and the existing minimum-cost fallback if no candidate passes. Inspector and JSON include this selection basis.
- TCS breakdown: same `tcsCostGroups` as the decision panel, with existing rounding. Cost attributes are display fields, not new OWL predicates.
- Contract KPI: reference values from the Chapter 5 dataset, explicitly not a fresh calculation from simulated downtime. No identified asset-contract link is manufactured.
- GPS: current dashboard GPS source, independently labelled; device geolocation does not establish the wind turbine's physical location.

## Event handling

At service start, capture pre-downtime readings, candidates, original proposal, source, GPS and ISO capture time. A saved simulation profile has a UUID and distinct event IDs. Completion attaches a post-service snapshot without replacing the original recommendation. Detached records deduplicate by event/status and retain the latest 30 events in browser local storage. Validated history import/export supports review and restoration. Interrupted records preserve partial hours without after evidence. A linked frozen graph pins both event and frame; changing events clears the old frame. Post-service graphs distinguish original proposal inputs from repaired observations.

Projected relationships use native SDT predicates and SOSA/PROV-O terms with explicit directions. The synthetic sensor node represents the existing vibration channel mapping; it is labelled as logical because no per-device identifier is supplied.

| Dashboard service key | Existing ontology class |
| --- | --- |
| condition-inspection | sdt:InspectionProcess |
| predictive-maintenance | sdt:PredictiveMaintenance |
| corrective-maintenance | sdt:CorrectiveMaintenance |
| preactive-maintenance, proactive-maintenance, active-maintenance | sdt:MaintenanceProcess |
| spare-prepositioning | sdt:ServiceProcess |

## Evidence boundaries

The live graph is a projection of runtime data into ontology terms. It does not claim persisted RDF instances, an online detector, executed SPARQL queries, OWL entailment, or SHACL conformance. A proposed service remains advisory until a simulation execution is recorded. Authorisation is absent in the current simulator. Completed simulation events can contain post-action observations but cannot establish a measured intervention effect. Outcome assessment and feedback stay pending; no authorisation, assessment or feedback entity is fabricated.

## Deferred work

The first version does not add a triple-store backend, persistent work-order ledger, actual human approval workflow, measured maintenance feedback, or cross-panel selection from the turbine animation/TCS cards. Those require explicit source records and a subsequent implementation. The new module supports these concepts without implying that they already exist.
