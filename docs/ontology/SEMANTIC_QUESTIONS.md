# WT Semantic Questions v1

## Request and scope

25 November 2026. Add preset questions, custom natural-language questions and inspectable answer evidence to WT Semantic Check. The DT must continue running during questions. Record implementation, checks and deployment in this repository.

Implemented in the existing dashboard on both [standard](https://jerryma619.github.io/wt-servitization-dashboard/) and [enhanced](https://jerryma619.github.io/wt-servitization-dashboard/enhanced/) routes. No new package, external language-model API, API key, server, physical-control connection, RUL model, repair model or TCS policy was introduced. Existing OME identity remains Physical WT with explicit simulation/reference provenance.

## User workflow

1. Open **Ontology & Decision Evidence > Semantic Check**. Entering the panel does not pause WT simulation or data capture.
2. Choose **Competency questions**, or **Natural language** and enter one English/Chinese question, for example `Why was this service recommended?`, `Which eligible service has the lowest TCS?` or `当前裂纹长度是多少？`.
3. Inspect **Recognized question** before interpreting the answer. This is bounded intent routing, not unrestricted language understanding. Ambiguous questions request clarification; unsupported questions are not executed.
4. Inspect **Answer & Evidence**: original input, recognized intent, captured context/time, snapshot ID/time, acquisition/feature origin, actual query rows and SHACL result. Expand the executed query and provenance/hashes when needed.
5. Export **RDF snapshot**, **SHACL report** or **Evidence + hashes**. The evidence JSON contains the captured packet, executed query, raw rows, RDF, validation report, deterministic answer and hashes.

Answers refer to their captured evidence, not subsequent live readings. The latest five answers remain in local memory only while the Semantic Check component remains mounted. Switching to another ontology tab, reloading or closing the page discards this answer buffer. Export needed evidence first. Questions are not uploaded or saved to GitHub by the app; only code, synthetic verification screenshots and test receipts are versioned here.

## Supported competency questions

Template version: `wt-cq-1.0`. Application profile: `wt-profile.ttl` version 1.1.

| ID | Question | Evidence boundary |
| --- | --- | --- |
| evidence | Why this service? | Captured recommendation, selection basis, eligibility, assumed cost, risk index and linked RUL; not an independent policy proof. |
| condition | WT condition | Crack mm, state, wind m/s, direction degrees, Z RMS g; absent crack is not zero. |
| rul | Blade RUL | Lower/P50/upper, synthetic pseudo-hours, model and bound meaning. |
| candidates | Which services qualify? | Captured candidate costs/risk indices and recorded eligibility. |
| cheapest | Lowest eligible TCS | Minimum among captured eligible candidates; ties by name; not global optimality. |
| rejected | Risk-filter rejections | Explicitly ineligible candidates, not merely unselected ones; exact rule version/threshold is not encoded. |
| costs | Selected cost breakdown | Captured item labels/values and reconciliation with assumed total within GBP 0.01. |
| provenance | Source/model provenance | Snapshot/time, optional observed/received time, feature origin and applicable model-artifact link. |
| features | RUL input features | Up to 31 named values from the linked feature window; not SHAP/importance evidence. |
| uncertainty | RUL bounds | Recorded interval meaning; not exact conditional P10/P90 or field-validated life. |
| latest | Latest service/downtime | Latest retained event, status, planned and recorded elapsed modeled downtime. |
| outcome | Latest service before/after | Recorded crack/P50/time/model differences; absent post-service evidence is not inferred. |
| authorisation | Human approval evidence | No approval evidence supplied: unknown/not established, not proof approval did not occur. |
| validation | Evidence validation | Actual WT SHACL profile result, counts and source ontology hash. |

Retained service history is filtered to the selected asset AND component, sorted by pre-service capture time and bounded to 30 events. It is not an all-time archive. Frozen/historical frames do not import later live events: history questions in those contexts return insufficient evidence. A natural-language question about "current" readings while a frozen/historical frame is selected requests clarification. **Use live evidence** changes the evidence source only, not global playback state.

## Implementation chain

`question/input -> bounded intent -> immutable packet -> worker -> RDF -> WT SHACL + fixed SPARQL -> deterministic answer + evidence`

- `src/ontology/semanticQuestions.ts`: 14 query templates and English/Chinese intent/guard patterns. Only whitelisted SELECT queries enter the engine; user text is never interpolated into SPARQL. No remote SERVICE or arbitrary query editor is exposed. Queries return at most 1/30/31 rows (COUNT returns one); the engine retains its 200-row safety bound.
- `src/ontology/semanticAnswers.ts`: executes a cloned packet, formats answers solely from actual bindings/report, distinguishes supported/insufficient-evidence/blocked, and creates evidence hashes.
- `src/ontology/semantic.worker.ts`: executes the RDF/SHACL/SPARQL engine outside the main UI thread. The parent can terminate it.
- `src/ontology/WtSemanticWorkbench.tsx`: captures snapshot AND retained events synchronously before the first asynchronous fetch; fetches the same-origin shapes with cancellation; runs the worker; keeps bounded answer history and downloads. Worker references, request IDs and an abort controller discard cancelled/stale responses. Timeout is 30 seconds, including fetch. Changing question or test case cancels the prior request; live WT updates do not erase completed answers.
- `src/ontology/OntologyPanel.tsx` / `src/App.tsx`: removed the implicit simulation-pause callback from Semantic Check and captured-record inspection. Explicit operator pause/manual hold remains respected: questions neither pause a running DT nor resume a deliberately paused one. No second simulator is introduced.
- `src/ontology/wtSemantic.ts`: extends the RDF export with explicit measurement units/timestamps, cost items and retained event summaries. Missing elapsed downtime is not substituted with planned downtime. Model-artifact and calibration wording are asserted only when applicable to the captured estimate, not legacy/manual overrides.
- `public/ontology/wt-profile.ttl` / `wt-shapes.ttl`: separate WT extensions and constraints for costs, units, optional timestamps and retained events, including nonnegative elapsed downtime no greater than planned, ordered before/after times and completed-event evidence. Original `sdt_tbox.ttl` / `sdt_shacl_shapes.ttl` are unchanged.
- `vite.config.ts`: ES-format workers support lazy semantic-engine chunks. The existing policy-comparison worker was browser-regression-tested after this shared configuration change.
- `package.json` / Pages workflow: adds `test:wt:questions` to deployment checks.

## Reliability and limitations

This first version provides traceable answers within a small, explicit query vocabulary. It is not a general chatbot and has no claimed general natural-language accuracy rate. Recognized intent is always displayed; a passing SHACL result does not establish correct language interpretation. Presets give the clearest reproducible demonstration.

Guards reject or clarify combined intents, unsupported assets/blades, raw code/SPARQL, named-service filtering, numeric/date/all-time filters, unsupported negation, causal/counterfactual questions, SHAP/importance, field accuracy/failure probability, physical failure-time prediction and ISO/full Chapter 4/OWL-conformance claims. Supported wording is tested, not every possible paraphrase. Expand vocabulary and a reviewed question corpus before claiming broader coverage.

SHACL validates this WT application profile, not physical truth, full original Chapter 4 conformance or ISO implementation certification. No OWL reasoner is added. Live Graph remains a separate dashboard projection. A nonconforming test copy blocks affirmative answers, even when some SPARQL rows exist. A conforming graph with no matching fact does not imply the fact is false. Missing approval, incomplete outcomes and unreconciled cost items are marked insufficient evidence.

RUL remains synthetic pseudo-hours. Adjusted interval bounds are not exact conditional P10/P90 or validated physical hours-to-failure. Model features are not necessarily connected sensor readings. Risk indices are not probabilities. GBP costs are assumed estimates, not invoices; minimum captured eligible TCS is not a global lifecycle optimum. Simulated before/after differences do not prove causal life extension. Different model versions receive an additional comparison warning. Human approval, hardware actuation and measured repair effectiveness remain unconfirmed.

Hashes cover RDF, snapshot, shapes, query, captured packet, result rows, report and a combined answer/evidence proof. Recomputing them detects changes relative to that export. They are not signatures, independent source authentication or proof that input data/answers are physically correct.

## Development and verification record

1. Inspected the existing three-question workbench, ontology mapping, service-event store, source/model provenance and separate simulation/capture controls. Identified implicit pause and live-update result invalidation as incompatible with the requested workflow.
2. Implemented the bounded templates/interpreter, RDF additions, deterministic answers, independent worker, UI and export. Kept all physical models, policy coefficients and original ontology sources unchanged.
3. Development checks found an unsupported `replaceAll` under the configured TypeScript target; replaced it with compatible regular-expression replacement. Worker code splitting initially conflicted with default IIFE output; explicitly configured ES workers. A test fixture originally shared a mutable event object; corrected it to clone before mutation. These were development issues, not physical-case findings.
4. Added nine new semantic-question tests, including 14 English/Chinese positive examples each and adversarial/ambiguous/out-of-scope examples, all real queries, immutable packets/hashes, retained-event ordering/cap/filtering, missing/legacy/manual provenance, incomplete history, invalid test copies, and cost reconciliation. Final full repository sweep: **all 15 test commands passed**: 75 named Node test cases plus seven additional CMAPSS script-based regression suites. These are different counting units, not 82 individual tests. `check:ontology` confirmed the original source-derived **50 classes / 64 properties**.
5. Production build passed. Existing large application/semantic-engine chunk warnings remain; no new runtime dependency was added. First screenshot review prompted clearer numerical column ordering, readable wide descriptive cells and stable submit/cancel geometry. Final desktop and 320 px images were visually reviewed.
6. Real Chrome browser checks on both routes ran all 14 templates in the actual module worker, exercised English/Chinese custom input and abstention, verified exported hashes and unchanged answers while live data moved, and tested HTTP 503/retry, cancellation/late-response discard, timeout/retry, negative SHACL copies, operator pause and frozen/current ambiguity. Responsive checks: 820/390/320 px. No page runtime errors. [Local receipt](../../screenshots/semantic-questions/verification.json).
7. Local delayed-query test: standard cursor **4 -> 21**, enhanced **4 -> 21**. In a separate query captured during downtime, completed-service count increased **0 -> 1** on each route. This verifies continuing service execution, not merely a changing wind display. Test-only simulator ticks were accelerated from 1400 to 100 ms and shapes responses delayed 1500 ms. The timeout branch used a compressed parent timer of 350 ms for the configured 30-second path; it is not a measured 30-second wall-clock test. Production timing was not changed.
8. Existing full viva/research browser regression passed on both routes, including semantic checks, actual four-policy/seven-sensitivity comparison worker, exports, playback, charts and mobile layouts. [Research regression receipt](../../screenshots/semantic-questions/research-regression.json). Unmodified copies of legacy verification scripts wrote transient screenshots outside the repository, preserving earlier historical receipts.

9. Existing DT/ontology lineage regression passed on both routes: immutable/deduplicated capture, source drilldown, independent capture/playback, evidence hashes, live updates, frozen mapping, captured-record semantic execution, complete service/downtime records and 390/320 px layouts. [Lineage receipt](../../screenshots/semantic-questions/lineage-regression.json).
10. Existing simulation-recovery regression passed on both routes: held 26.5 mm input resumed through all control paths, reload preservation, replay/frozen-view recovery, independent capture preference, unchanged completed events and a new service cycle (completed count 2 -> 3). [Recovery receipt](../../screenshots/semantic-questions/recovery-regression.json).

Public deployment receipts are recorded below after they complete.

### Reproduction

Use the repository lockfile and Node 22 or the tested Node 24 runtime. No additional installation was needed for this change. Example commands:

```sh
npm run check:ontology
npm run test:wt:questions
npm run build
npm run preview -- --port 4173 --strictPort
node scripts/verify-semantic-questions-ui.mjs
```

The browser script accepts `PLAYWRIGHT_MODULE`, `CHROME_EXECUTABLE` and `DASHBOARD_URL`. Default is the production-base preview `http://127.0.0.1:4173/wt-servitization-dashboard/`. Use `DASHBOARD_URL=https://jerryma619.github.io/wt-servitization-dashboard/` for public-route checks. It creates isolated browser contexts and writes generated-simulation screenshots/JSON to `screenshots/semantic-questions/` or its `public/` subdirectory. Modern module-worker support is required. The complete CI test list is in `.github/workflows/deploy-pages.yml`.

## GitHub publication

Application commit, successful deployment run and public verification will be appended after publication; local checks above are not claims of a completed public deployment.
