# Evaluation audit and renewed examiner review — v0.8

## What changed

The walkthrough now exposes a retrospective matched-cycle comparison, separates
uncertainty scoring from eligibility, diagnoses full test-endpoint coverage and
its 125-cycle cap, expands semantic regression checks, and positions candidate
contributions against named sources. The automatic overview remains nine scenes;
manual expandable panels contain these details and downloadable records.

No field outcomes or independent reviewers have been invented. A downloadable
external-evaluation protocol explicitly says **not conducted**. It specifies
independent questions/withheld fixtures, equal tasks and evidence requirements,
and prospective contract, authorisation and outcome records. A protocol is not
an evaluation result.

## Matched observations

The rule is complete integer cycles 30–120, inclusive, within the existing eight
FD001 replay engines. Seven engines contribute 91 records each (637 total).
Engine 001 has only two of these records and is excluded visibly. No outcome or
action is used to decide eligibility. This is a retrospective diagnostic chosen
after reviewing the existing dataset, not preregistered sampling. Equal cycle
ranges do not mean equal degradation stages; short-record exclusion and earlier
observation selection remain limitations.

For availability assurance, widening intervals to 1.25 times changes 4/637
matched-window actions (0.63%), compared with 150/1,233 (12.17%) across full replay.
For maintenance support the matched-window result is 0/637. These differences
expose window dependence; they do not show improved whole-life robustness. Both
views are retained. Frame and equal-engine weighting coincide in the matched
sample because all included engine windows have the same size.

## Mechanism separation

Using all 1,233 replay snapshots, independently vary the interval used to compute
risk scores and the lower bound used for eligibility. Production `decide`
provides candidate scores; the diagnostic separately reapplies the eligibility
rule. Production recommendations and default policies are unchanged.

| Scoring width | Eligibility width | Changes: maintenance support | Changes: availability assurance |
| --- | --- | --- | --- |
| 1 | 1 | 0 | 0 |
| 1 | 1.25 | 31 | 48 |
| 1.25 | 1 | 91 | 150 |
| 1.25 | 1.25 | 97 | 150 |

The mixed rows are analytical constructs, not calibrated deployable intervals.
Counts are not additive effects. They identify rule behaviour, not causal service
benefit. Transition counts and exact policies accompany the exports.

## Frozen endpoint interval audit

Each test engine contributes one endpoint. Predictions remain frozen; truth is
uncapped. FD001 is reconstructed from original hash-checked inputs, the existing
final-fit recipe and stored training-only residual quantiles. All eight replay
endpoints and published full-set RMSE/coverage are reconciled. FD002–FD004 use the
existing saved full-endpoint records. No test-set refit, interval selection or
recommendation tuning occurs.

| Subset | All covered / n | Truth ≤125 covered / n | Truth >125 covered / n |
| --- | --- | --- | --- |
| FD001 | 78/100 | 78/89 | 0/11 |
| FD002 | 174/259 | 174/202 | 0/57 |
| FD003 | 69/100 | 69/85 | 0/15 |
| FD004 | 152/248 | 152/181 | 0/67 |

All >125-cycle truths necessarily exceed the clipped upper bound. Conditional
within-cap coverage explains this structural limitation; it does not replace
primary overall coverage or prove calibration. The 80% reference comes from
training residual 10/90 quantiles, not a finite-sample guarantee. The normal
probabilities used by the action rule need their own validation. The current
test set has now been inspected diagnostically and must not be described as
unseen to a later redesign. Future recalibration requires a frozen protocol and
an untouched evaluation set; simply widening intervals on these test labels
would give optimistic evidence.

## Semantic checks and external evaluation

The original seven fixtures remain. Thirty-five additional project-authored
cases exercise all 32 subsets of five defects plus consistent contract-version
migration, stale advice after migration, and consistent identifier migration.
Both unchanged validators and provenance queries agree on the specified results.
The combined malformed-hash case remains in tests. Expected error sets are
specified by the defect masks, not copied from either validator's output.

This remains the scalar comparison profile, not arbitrary multi-source JSON/RDF
or the complete ontology. These are regression checks, not independent authored
questions, unseen defects or measured development effort. No overall accuracy
rate is inferred. The downloadable protocol identifies the independent work
still required and the actual service records needed.

## Focused source positioning

Checked 6 October 2026. This is a selected-source comparison, not a systematic
literature review. It does not infer a capability is absent because a source
abstract does not mention it.

| Source and reading scope | Existing capability | Consequence for this project's claims |
| --- | --- | --- |
| [ISO 23247-2:2021](https://www.iso.org/standard/78743.html), official scope | Manufacturing reference architecture with entity and functional views | Responsibility groups are adopted. Service-specific mapping and its evaluation are candidate increments, not architecture invention or conformance. |
| [Longo, Nicoletti & Padovano](https://arxiv.org/abs/2206.03268), author abstract; journal article 2019, deposited 2022 | Service-oriented DT with ontology-oriented knowledge and two manufacturing test-beds | Combining DT, services and ontology is prior art. This prototype emphasises explicit assumed responsibility and inspectable recommendation evidence; full-method comparison remains. |
| [Nguyen, Schulte & Lindow (2025)](https://doi.org/10.1007/978-3-031-93891-7_56), publisher abstract/introduction | Ontology-based turbine-blade maintenance framework; abstract places implementation and validation in future work | A maintenance ontology/framework alone is not a new claim. Executed queries and bounded comparisons are local implementation evidence, not a universal superiority claim. |
| [W3C SHACL](https://www.w3.org/TR/shacl/), 2017 Recommendation | Standard RDF constraint validation | Contribution must concern the service evidence requirements and application; constraint execution itself is adopted technology. |

## Renewed examiner judgement

**Share with caveats.** The implemented analysis and claims are more inspectable.
The largest new finding is that overall interval coverage mixes prediction
behaviour with a structural target cap. Matching observation windows also
substantially changes the descriptive action-change rate. These findings should
be discussed, not hidden by headline figures.

Remaining research priorities are independent semantic evaluation and external
source mapping, new untouched evaluation for recalibration, empirical service
records and full-text prior-work comparison. A conventional comparator matching
RDF is informative and is retained. Adding more authored tests cannot replace
independence. The source matrix prevents overclaiming; it does not establish
novelty. Neither case validates an industrial closed loop.

## Reproduction and verification

- `python scripts/cmapss/audit_fd001_endpoints.py /path/to/CMAPSSData` recreates the missing FD001 endpoint audit without changing the published model/replay.
- `npm run record:cmapss:evaluation` generates `src/cmapss/evaluation-evidence.json` with input/code hashes.
- `npm run test:cmapss:evaluation` verifies matched inclusion, missing/noninteger records, reference/joint mechanism reconciliation, cap boundaries, null empty strata, denominators, coverage and hashes.
- `npm run test:cmapss:comparison -- --record` executes and records all semantic cases.
- Story tests preserve original decisions and semantic checks; browser tests exercise new tables/exports and 390/320px layouts.
- `scripts/cmapss/build_explanation.py` generates the updated Word companion with the bundled document runtime. Rendering and final public verification are recorded on the release PR.
