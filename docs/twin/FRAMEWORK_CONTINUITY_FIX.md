# Framework Continuity Fix - 2026-10-02

## Report and Root Cause

The user reported that the DT Framework disappears after a cycle and requested continuous workflow display alongside turbine operation. No stage-triggered `setOverlay(false)` call existed. A continuous-update browser reproduction identified the actual renderer problem: controlled node definitions were regenerated on telemetry updates without carrying ReactFlow's measured `width`/`height`. The installed ReactFlow v11 `createNodeInternals` takes dimensions from those definitions; missing dimensions make NodeWrapper render `visibility: hidden` and prevent edges from rendering. DOM node counts alone did not detect this earlier.

There was also a presentation gap: decision highlighting replaced monitoring, and result highlighting lasted only one reading. The default overlay was off.

## Changes

- Keep controlled nodes in `useNodesState`, apply measurement changes with `onNodesChange`, and merge measured dimensions into new telemetry definitions. Preserve node identity and viewport while updating values.
- Show the framework by default. Completion, new readings, replay completion and return to live do not close it; explicit user hiding remains supported.
- Define active connections explicitly. Acquisition/synchronisation/evidence access remain active; operating monitoring and RUL continue during decision-making. Downtime highlights recorded execution/hold, not fabricated new RUL inference. Result connects execution back to post-service collection and refreshed condition/RUL/state, then the next readings continue normal workflow.
- Missing authorisation and reference-only contract KPI remain inactive. No new real control, measured assessment or calibrated model evidence is asserted.

## Verification

`scripts/verify-framework-cycle.mjs` samples the standard and enhanced routes every 25 ms during two complete automatic maintenance cycles. It checks all 12 nodes' actual CSS visibility, active/animated edges through every stage, post-service rotor motion, 1024/390 px UE reachability and explicit hide/show behavior. Only simulator ticks are accelerated in isolated tabs; normal timing is unchanged. Screenshots/results: `screenshots/framework/`.

`test:twin` adds a repeated-cycle connection regression. Existing model, ontology and replay tests remain applicable. The production bundle warning is unchanged. Publication uses the existing GitHub Pages workflow.

Local verification passed: 6 twin tests, 11 model tests and 5 ontology tests; production build; existing twin/replay browser regression and the new continuity test. The final continuity run sampled 402 standard and 404 enhanced observations spanning monitor, decision, downtime and result, including operation after two completions, without hidden modules or lost active edges. The new test also checks actual inherited CSS visibility, not just mounted node counts.

## Publication

Implementation commit [`38ba930`](https://github.com/JerryMa619/wt-servitization-dashboard/commit/38ba930) deployed successfully via [Actions run 36940292491](https://github.com/JerryMa619/wt-servitization-dashboard/actions/runs/36940292491). Both public routes passed the same two-cycle visibility/animated-flow regression, sampling 359 standard and 360 enhanced observations. Public results and screenshots: `screenshots/framework/public/`. A follow-up documentation/evidence commit records this verification without changing runtime behavior.
