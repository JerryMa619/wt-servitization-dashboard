# Second viva revision and post-change review

Date: 2026-10-06. Scope: C-MAPSS story v0.7 and its Word companion. The WT
implementation, predictive models and default advisory function are unchanged.

## Implemented revisions

1. Cross consequence {5,20} with margin {15,25} at fixed cycles 158 and 171.
   Maintenance cost and waiting multiplier stay 1. These four analytical scenarios
   isolate rule mechanisms, not causal effects on physical service outcomes.
2. Break each sensitivity row into engine counts/rates, all action transitions,
   first recorded Planned Maintenance advice cycles and shifts. Report frame-
   weighted and equal-engine summaries separately. Null means not observed in
   available replay, never no later event. Negative shifts mean earlier advice.
3. Execute a bounded conventional JSON versus RDF/SHACL comparison. Five shared
   requirements and seven equivalent fixtures answer one provenance question.
   Both implementations are executed; results are not canned badges. Reports,
   fixtures, query, shapes, hashes and model/source provenance can be exported.
4. Explain operator requirement, assumed provider responsibility, policy use,
   future planner review and absent delivery. No actual participant authority or
   approval is invented; the 99% target does not determine cost/margin values.
5. Add cross-case synthesis: reusable method, necessary unit/model/action
   adaptations, what C-MAPSS adds and what both cases leave unresolved.

## Results and interpretation

At cycle 171 (point 45.0418, lower 20.139 cycles):

| Consequence | Margin | Advice |
| --- | --- | --- |
| 5 | 15 | Enhanced Monitoring |
| 20 | 15 | Inspection |
| 5 | 25 | Planned Maintenance |
| 20 | 25 | Planned Maintenance |

For availability assurance with interval width ×1.25: 150/1,233 actions change
(12.17% frame-weighted); equal-engine mean is 10.68%. Changed transitions are
92 Continue→Monitoring, 48 Monitoring→Maintenance and 10 Monitoring→Inspection.
For Engine 034 first observed maintenance advice moves from cycle 171 to 162;
this is advice timing, not executed maintenance or a benefit estimate. Other
engines and unchanged transitions are retained in the downloadable result.

## Equal-requirement experiment specification

The neutral fixture is materialised from FD001 Engine 034 cycle 171 and the
availability-assurance assumptions. Both paths receive the same typed values and
perturbations. JSON validation uses direct field/equality checks and a regex;
RDF validation uses independently expressed SHACL Core paths/equality/pattern
constraints. A JavaScript join and SPARQL SELECT retrieve the same asset,
estimate, estimate asset, model, source, contract version and action fields.
The query is deliberately separate from validation; an invalid record can still
produce query rows. Neither path silently upgrades queryability to approval.

| Requirement | Shared meaning |
| --- | --- |
| R1 | Explicit cycles unit |
| R2 | Estimate asset equals snapshot asset |
| R3 | Used contract version equals supplied expected version |
| R4 | Estimate has a 64-character hexadecimal source hash |
| R5 | Recommendation links to the snapshot estimate |

Fixtures: valid evidence; missing unit; hours instead of cycles; wrong asset
link; outdated contract version; missing source; missing estimate link. Both
paths meet these seven fixture expectations and return equivalent query answers.
Automated tests additionally combine all five defects and use a malformed
nonempty hash. The shared representation has scalar fields, not arbitrary JSON
or arbitrary RDF cardinality/type structures. Results are restricted accordingly.

This is a separate comparison profile using local `urn:cmapss:comparison:`
identifiers. It does not extend or validate the entire production ontology,
implement an approval gate, consult an authoritative contract registry, measure
execution-speed advantage, or demonstrate heterogeneous-source interoperability.
Expected version is supplied metadata; no version-history service is claimed.
The appropriate conclusion is bounded functional parity, not ontology superiority.

Machine-readable records: `comparison-evidence/bounded-comparison.json` and
`comparison-evidence/decision-analysis.json`. Reproduce the first with
`npm run test:cmapss:comparison -- --record`; the second invokes the exported
`sensitivityReport` for both contracts and `contractFactorial` at cycles 158/171.

## Post-change examiner review

**Improved:** Contract-factor attribution can be checked; action change counts
are no longer opaque aggregates; a conventional comparator actually runs; the
service process and the role of the two cases are explicit. The defensible
result is an executable, inspectable method with bounded comparison evidence.

**Remaining high priority:**

- The comparator fixtures and requirements are authored within this project.
  Add independently specified competency questions, unseen defects and change
  tasks before claiming broad semantic benefit. Avoid treating 7/7 as a general
  accuracy rate or claiming parity for the complete ontology.
- Observation windows are unequal. Engine 001 contributes only two snapshots;
  equal-engine averaging assigns it the same weight as long records. Both
  summaries are useful descriptions but neither establishes representativeness.
  Next evaluate prespecified engines and matched observation ranges.
- Width perturbation changes both normal-approximation scoring and margin
  eligibility. It is a robustness probe, not isolated causal attribution or
  calibration. Full calibration and interaction analyses remain necessary.
- Unit/model/action adaptations show implementation reuse, not universal
  architecture validity. Prior-work novelty and field service outcomes remain
  open. A numerical benefit comparison using the same assumed objective alone
  would be circular evidence of operational value.

**Presentation:** Keep the automatic overview concise. The new analytical panels
are expandable in manual mode; use them to answer questions rather than reading
all tables during the three-minute story. The Word companion records the same
scope, results and remaining issues.

**Verification:** Actual comparison and player/statistical-reconciliation tests
passed locally. Browser and release validation are recorded on the release PR.
