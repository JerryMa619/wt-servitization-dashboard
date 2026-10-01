# C-MAPSS demonstration guide / 演示指南

Start: `npm install` then `npm run dev -- --port 5178`; open <http://127.0.0.1:5178/cmapss/>. The route also supports the repository's production base path. Main-branch Pages deployment is not performed by opening the PR.

## Contract comparison (v0.3)

In **Service decisions**, compare the two declared contract presets, use the cost-driven / earlier-intervention example buttons, then apply one and query its RDF/KPI evidence. [Comparison assumptions and calculations](CONTRACT_SCENARIOS.md).

## Guided version 0.2

Use the four Engine 034 stage buttons (cycles 30 / 94 / 158 / 181), then **Validate this snapshot** to execute RDF generation, SPARQL and SHACL. See the [guided and semantic workflow](SEMANTIC_WORKFLOW.md) for the full demonstration, negative examples and unit adaptation.

## Free exploration

1. **Twin overview / 运行状态** — Engine 034 starts paused at cycle 80. Play or seek through the actual FD001 observations. RUL and service state update together. The drawing is conceptual geometry. Evaluation truth is optional and is never used in the service advice.
2. **DT framework / 框架** — Select OE, DCE, DTE, UE or Cross-System. The panel explains the input, output and servitization extension against the same engine/cycle. Toggle extensions to explain the proposed additions separately from the architecture mapping.
3. **Ontology explorer / 本体** — In Instances, click a node to inspect its type, evidence origin and directed relationships. Schema browses all 50 source classes and directly declared property domains/ranges, and downloads the source TTL. Evidence explains the recommendation in six steps and downloads a detached JSON record.
4. **Service decisions / 服务决策** — Seek Engine 034 to its last cycle. Three operational alternatives are excluded by the lower-RUL guardrail. Raise planned-maintenance cost to 2: Derate/Hold becomes the least-cost eligible advisory. Reset assumptions restores the baseline. These are scenarios; no maintenance is actually executed.
5. Export evidence and point to the model/source hashes, cycle units, policy settings and unrecorded execution/outcome fields.

## UI and limits

- Eight engines, FD001 only. Four shared-state views. Engine selection resets to the first available model snapshot; end-of-trajectory playback stops automatically.
- English research-demo interface; this guide is bilingual. Responsive desktop/mobile layouts.
- Framework selection is an explanatory architectural mapping, not measurement of live service traffic.
- No component localisation, physical connection, action execution, realized contract KPI or full-source-ontology conformance is claimed. The separate application profile is actually validated in Semantic check.
- Raw data archives and private thesis documents are not published.

## Validation

```sh
npm run check:ontology
npm run test:ontology
npm run test:cmapss
npm run test:cmapss:semantic
npm run build
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs CHROME_EXECUTABLE=/path/to/chrome node scripts/verify-cmapss-ui.mjs
```

The browser script accepts `DASHBOARD_URL` (default <http://127.0.0.1:5178/>), captures desktop/mobile views and checks replay, scenario changes, semantic inspection, exports, short trajectories and existing routes. Screenshots and machine-readable results are in `screenshots/cmapss/`. Python causal-prefix verification and regeneration require the raw NASA files.

## v0.4 — compare the four subsets

Select **Dataset** in replay controls. **Twin overview** compares full-test endpoint RMSE and interval coverage for all four separately trained models. Explore DT framework, ontology and service decisions using each subset's own evidence. Switching resets replay/evaluation/policy. Return to FD001 for the original guided story and curated contract examples. See [MULTI_DATASET.md](MULTI_DATASET.md) for the FD004 count discrepancy and model limitations.
