# Viva evidence revision — 2026-10-06

Current v0.7 update: [computed comparisons and renewed viva review](VIVA_COMPARISON_REVIEW.md). Includes a cost/margin factorial, per-engine sensitivity, an executable equal-requirement JSON/RDF comparison, and cross-case synthesis. Earlier version notes below retain their historical scope.

## Research position

This case demonstrates an evidence-to-advice prototype, not a complete physical
service twin. The opening separates asset evidence, represented service context,
and absent authorisation/delivery/outcome steps. Operator, provider and planner
are explanatory roles; no real participant approvals are supplied.

The framework/ontology sequence follows implementation order: replay input,
precomputed prognosis, TypeScript advice, then RDF materialisation and executed
SPARQL/SHACL. Semantic validation is not an operational decision gate. There is
no OWL action inference. A conventional required-field check could also detect
the missing unit. Consequently that example proves executable validation, not
ontology superiority.

## Two complementary cases

| Dimension | Micro wind turbine | C-MAPSS |
| --- | --- | --- |
| Research question | How can the service process operate within the architecture? | How can technical evidence justify contract-context advice? |
| Principal evidence | Simulated service selection, downtime, repair, state updates, policy comparison | Original simulation-benchmark observations, prefix estimates, explicit contract scenarios, semantic trace |
| Framework focus | Allocation and coordination of monitoring, decision and simulated service functions | Responsibility boundaries and evidence handoff between data, prognosis and advice |
| Ontology focus | Captured operational snapshot, candidate actions, model/feature provenance | Asset/cycle identity, units, estimate/model/source links and applied contract-policy provenance |
| Evaluation focus | Reproducible simulated service accounting and policy sensitivity | Prognostic uncertainty, fixed-evidence contract comparisons and replay sensitivity |
| Limits | Simulated/reference-assisted condition, pseudo-h prognosis, assumed costs; no independent field intervention validation | No maintenance trajectories or actual contracts; no service outcome/closed-loop validation |

The common research method is responsibility mapping plus semantic evidence and
explicit service decisions. Neither case, nor their combination alone, proves
industrial effectiveness or generalisability. The WT description refers to the
current implementation in `docs/research/WT_VIVA_IMPLEMENTATION.md`; this revision
does not change that case's code, models or experiments.

## Computed sensitivity and threshold comparator

`src/cmapss/viva.ts` runs the existing production `decide` function on 1,233
snapshots from the eight selected FD001 replay engines. These are correlated
frames, not independent replicates or a representative sample of all engines.
No ground-truth labels, other-subset predictions or physical outcomes enter this
analysis. Both named contracts are selectable.

Nine rows: reference; consequence cost ×0.75/1.25; margin −/+5 cycles; action
waiting periods ×0.75/1.25; interval width ×0.75/1.25. Each row changes one factor
only. Interval perturbation holds the point estimate fixed, scales each bound's
distance from it and clips to 0–125. It is an assumed perturbation, not calibrated
uncertainty. The table reports changed action count versus the reference and
disagreement with a threshold-only rule under the same perturbed evidence/margin.
That comparator selects Planned Maintenance at lower-bound <= margin and
Continue otherwise. It is a transparent comparator, not a claim to reproduce a
published or industrial policy. Export adds full action counts, exact policies,
model identity and source hashes. No statistical confidence interval or cost
saving claim is derived from frame counts.

Decision formula: direct cost + assumed consequence × normal-approximation
probability over the action waiting period. Planned Maintenance / Hold have zero
waiting period and therefore zero modeled pre-intervention exposure. This does
not mean zero execution/residual risk. Monitoring has no modeled information
gain. These omissions limit any interpretation of policy optimality.

## Presentation changes

- Automatic nine-scene overview retained; manual Viva mode pauses timing and
  disables automatic Play. Chapter navigation and actual semantic checks work.
- Opening dual chain and explicit service actors; sequential responsibility /
  exchanged-object / check explanation at the semantic scene.
- Per-scene examiner questions separate demonstrated answers from open evidence.
- Contributions distinguish implemented capability, actual evidence and missing
  research comparisons. Technical details are expandable.
- Complementary-case cards and an expandable architectural mapping remain below
  the scene; all content and exports remain English.

## Outstanding research, not claimed as completed

1. Conventional-schema comparison on equal competency questions, defect fixtures
   and cross-source integration/change tasks; measure query coverage, detected
   errors and changes required without favouring one implementation.
2. Heterogeneous data/contract identity and unit mapping. Current named-contract
   examples do not establish inter-organisational interoperability.
3. Prior-work comparison for architectural/ontological novelty and reuse.
4. Recalibration and decision robustness on independently held-out engines and
   other subsets. Present sensitivity is descriptive FD001 replay evidence.
5. Empirical costs/contracts, approval governance and prospective intervention /
   service-outcome evaluation. C-MAPSS alone cannot supply those outcomes.

These are evidence requirements, not promises disguised as demonstrated results.

## Verification

Player tests include denominator/action-count reconciliation, reference stability,
threshold-comparator agreement, bounded perturbations, input immutability and no
dependency on evaluation labels. Browser tests cover the entire automatic story,
manual mode, handoff, actual checks, sensitivity selection/export, expanded narrow
layouts and all prior failure/retry/exit behaviour. Final local/public results
are recorded on the release PR.
