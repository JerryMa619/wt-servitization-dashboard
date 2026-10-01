# Guided demonstration and executable semantics (v0.2)

Tracking: [Issue #1](https://github.com/JerryMa619/wt-servitization-dashboard/issues/1), [PR #2](https://github.com/JerryMa619/wt-servitization-dashboard/pull/2).

## Five-minute demonstration / 五分钟演示

The four guide buttons select Engine 034, pause playback, restore baseline scenario parameters, hide evaluation truth and open the appropriate view. Milestones are derived from the **first observed entry** into each baseline service state, not hard-coded synthetic events. The model can fluctuate later; these are not irreversible physical transitions.

| Stage | Cycle | View | Explanation |
| --- | --- | --- | --- |
| 正常 / Nominal | 30 | Twin overview | Establish observations, RUL and baseline service context. |
| 关注 / Watch | 94 | DT framework | Explain how acquisition and prognosis produce the service state. |
| 预警 / Alert | 158 | Ontology → Semantic check | Generate RDF, query the evidence and validate its structure. |
| 建议维护 / Hold | 181 | Service decisions | Show the guardrail excluding three actions and the remaining cost comparison. |

At the first three milestones, the baseline advisory remains Continue. State classification is not the same operation as service-action selection. At cycle 181 the lower bound is 14.3315 cycles, activating the 15-cycle guardrail; Planned Maintenance has the lowest eligible cost. No maintenance or physical Hold has been executed.

Select **Validate this snapshot** from any stage. In **Semantic check**:

1. Leave **Current snapshot** and **Why this recommendation?** selected; click **Run RDF / SHACL / SPARQL**.
2. Inspect the actual query result, triple count and C-MAPSS-profile conformance result.
3. Select **Test copy: remove cycle unit**, then run again. SHACL fails and the evidence query returns zero rows.
4. Select **Test copy: remove recommendation evidence link**, then run again. SHACL reports the missing `cm:basedOnEstimate` link.
5. Restore Current snapshot; run either of the other questions to inspect five action candidates or seven observed sensor channels.
6. Download the RDF snapshot, RDF SHACL report, exact SPARQL text and result JSON with dataset/shapes SHA-256 hashes.

Changing the engine, cycle, scenario, query or fault-injection choice invalidates the displayed result immediately. An old asynchronous result is never displayed as valid for a different selection. Running pauses replay; the workflow does not persist data to a server or alter raw observations. Exports are the durable evidence record.

## Actual execution

- **N3** creates an RDF/JS store and serializes Turtle.
- **rdf-validate-shacl 0.6.5** executes the shipped SHACL Core shapes against that store. Both positive and negative results come from the library's report, not UI flags.
- **Comunica query-sparql-rdfjs 5.4.1** executes the shipped SPARQL SELECT queries against the same store. It reads the current in-memory dataset; there is no remote SPARQL endpoint.
- Semantic libraries are loaded on demand. Query text and shapes are local public assets, included in the production build.
- Browser downloads include dataset and shapes hashes; reproducible reference artifacts are under `docs/cmapss/semantic-evidence/`.

References: [Comunica RDF/JS sources](https://comunica.dev/docs/query/advanced/rdfjs_querying/) and [rdf-validate-shacl documentation](https://github.com/zazuko/rdf-validate-shacl/tree/master/packages/shacl).

## Unit-aware ontology adaptation

`public/cmapss/cmapss-profile.ttl` defines an explicit application extension, version 0.2.0. Its namespace is a local vocabulary identifier; external registration or dereferenceability is not claimed.

`cm:CycleRULEstimate` is an information entity with `cm:lowerBound`, `cm:pointEstimate`, `cm:upperBound`, `cm:cycle`, and `cm:unit cm:Cycle`. The point is not labelled a calibrated median, and the interval remains an empirical residual interval. Decimal RDF literals avoid exponent notation.

The source `sdt:RULEstimate` has mandatory hours attributes. The extension therefore **does not subclass or equate to that class**, and only uses `rdfs:seeAlso` to indicate the related concept. No hours values are fabricated, no cycles-to-hours factor is assumed, and the original T-Box and SHACL files remain byte-for-byte unchanged.

The RDF reuses `sdt:Asset`, `sdt:ServiceState`, `sdt:Contract` and `sdt:ServiceActionRecommendation`, with SOSA observations and PROV evidence links. A model-artifact node records both baseline and exporter hashes, plus the training-file source; an observation-window node references the test-file hash and cycle range. Only seven endpoint display observations are materialized; the complete 30-cycle model input window remains reconstructible from the original file and the window bounds. Full training data, test ground truth, inferred location and executed intervention instances are not added.

Recommendation IRIs include engine, cycle and scenario values. A cost-only scenario change keeps the estimate identity and changes the recommendation identity. The selected candidate and all five candidate costs/eligibility values are explicit RDF data, computed with the existing advisory function before serialization.

## Scope of SHACL

The application shapes require a fixed snapshot root, asset/state/contract links, explicit cycle units, ordered nonnegative bounded RUL values, source and model hashes, observation references, policy parameters, a recommendation-to-estimate link, five candidate records, and an eligible selected candidate. They reject hours attributes on the cycle estimate. An empty graph cannot pass vacuously because the root is a `sh:targetNode`.

A pass means **C-MAPSS application-profile conformance**, not full source-ontology conformance. The complete Chapter 4 shapes also require things C-MAPSS does not supply (for example site and component assertions). Those shapes are not silently weakened or claimed to have passed. Their original downloads remain available separately. No OWL inference, SHACL-SPARQL constraint execution, cost-optimality proof, model-accuracy proof, contract compliance or physical maintenance effect is implied.

The UI's overview graph remains a simplified projection. Executable RDF, actual query rows and conformance reports live in Semantic check; the generic application JSON export does not claim that a semantic check ran.

## Reproduce and test

```sh
npm ci
npm run test:cmapss:semantic
node --experimental-strip-types scripts/test-cmapss-semantic.mjs --record
npm run build
```

`--record` saves the valid Engine 034 / cycle 181 dataset/report and a validation summary. Tests cover all four milestones, three SPARQL queries, all eight endpoint engines, scenario-sensitive IRIs/advice, RDF roundtrip, unchanged T-Box hash, no hours or evaluation-truth assertions, and invalid unit/evidence/hash/policy/bounds cases.

Browser verification (with Playwright and Chrome available):

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs CHROME_EXECUTABLE=/path/to/chrome node scripts/verify-cmapss-semantic-ui.mjs
```

`DASHBOARD_URL` can select a production-preview base. Captures and machine-readable results are in `screenshots/cmapss-semantic/`.

## Implementation limits

The RDF store is a per-run browser snapshot, not a persistent triple-store service. Query choices are reviewed SELECT queries; arbitrary user queries and external graph imports are intentionally outside this implementation. The added semantic-query bundle is about 389 kB gzipped and lazy-loaded on first execution. Vite reports large shared/query chunks. Compatible dependency patches were applied; the existing ECharts 5.x moderate advisory remains and requires a separate major-version migration to address. No new semantic-library advisory remained in the recorded audit.
