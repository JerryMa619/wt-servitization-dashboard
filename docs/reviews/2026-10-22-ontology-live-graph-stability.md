# Ontology Live Graph Stability

Date: 2026-10-22 (Europe/London).

## Reproduction and Cause

The reported blank graph was reproduced in an isolated mobile browser:

1. Start a service-threshold demo and complete a simulated intervention.
2. Open Decision Trace and View graph. Focus mode displays the historical
   execution and its related evidence (three nodes in the captured reproduction).
3. Resume Live Graph. The execution is correctly absent from the live snapshot,
   but the old focus filter still selects that missing ID, producing zero nodes.

The inspector correctly reports missing evidence; the bug was the empty focused
view, not missing underlying WT data. No browser-process crash or uncaught page
exception was observed in this reproduction. A separate flicker risk was present:
the ReactFlow key depended on selection/context, remounting the graph on focus
changes. Initial-only fitView also made rapid remount/resize transitions fragile.

A stricter frame-visibility soak exposed a third cause after the focus fix:
the live node definitions discarded ReactFlow's measured width/height. In the
installed renderer, those missing dimensions set `visibility: hidden` despite
the DOM nodes still existing. Node-count-only checks therefore missed this
failure. The intermediate `soak-diagnostic.json` records a measured bounding box
and hidden visibility before dimension preservation was added; it is not a
final passing report.

Evidence: `screenshots/ontology-stability/reproduction.json` and `before-empty.png`.

## Scoped Fix

- `semanticGraphView` preserves all available evidence when a requested entity
  does not exist. The inspector still says No matching evidence and a visible
  notice explains the fallback; no execution/authorisation is fabricated.
- ReactFlow remains mounted across node selection and live/history context
  changes. Edges use stable source/predicate/target identities.
- Node state and dimension changes are handled using the existing TwinWorkspace
  pattern. Live definitions retain valid same-type measured width/height without
  copying old reading values, selection or positions. This prevents repeated
  hidden/uninitialised nodes during ordinary data updates.
- The viewport refits only measured topology/layout or container-size changes,
  not every telemetry tick. Zero-sized containers are ignored and scheduled
  animation frames are cancelled on unmount. User pan/zoom is retained during
  ordinary live updates. A lower minimum zoom accommodates full mobile graphs.
- A graph-only error boundary retains the rest of the dashboard/inspector and
  provides Retry graph if a renderer fails. It does not hide unavailable evidence
  or claim to catch all asynchronous/browser-process failures.

No RUL model, sensor input, service policy, TCS parameter, ontology assertion,
saved-session format or dependency version was changed.

## Verification

- Four new pure tests cover missing-entity fallback, focused neighborhoods,
  layout keys that ignore telemetry and retained valid dimensions. The complete
  Node test run passed 70 reported tests. TypeScript and production build passed with existing
  large-chunk warnings.
- Standard and enhanced routes passed historical/live recovery, persistent DOM
  identity across node selection, user-camera retention during telemetry,
  repeated tabs, hidden/visible canvas and 320/390/820/1440 px resizing.
- Three simulated service events per route were sampled using computed visibility
  and clipped node bounding boxes, not just DOM counts. Final local runs sampled
  317 standard-route and 327 enhanced-route frames with zero frames lacking a
  visible node. Counts and exact outcomes are in the browser verification JSON.
- A local-only network fixture deliberately throws in the custom entity
  renderer. The fallback and retained inspector were verified, and Retry graph
  restored the nodes. No debug hook or injected exception ships in production.
- The full existing WT lineage browser suite passed on both routes, including
  record capture, hashes, frozen history and actual RDF/SHACL/SPARQL execution.
  Temporary regression artifacts were kept outside the existing lineage evidence.

Local results: `screenshots/ontology-stability/verification.json`; browser script:
`node scripts/verify-ontology-stability-ui.mjs` with the existing Playwright/browser
environment variables. `--reproduce` captures the original diagnostic sequence;
successful recovery does not overwrite the pre-fix reproduction evidence.
Public checks use `DASHBOARD_URL` and write to a separate `public/` subdirectory.

Publication and public verification are recorded below once confirmed.

## Public Verification

Fix commit `23f78df` was published on 2026-10-22 (Europe/London). The
[Pages workflow](https://github.com/JerryMa619/wt-servitization-dashboard/actions/runs/39694361100)
passed tests, build and deployment. The public standard/enhanced routes passed
the same stability checks, excluding the deliberately injected local-only fault.

The published standard route sampled 297 frames and the enhanced route 301 frames
across three service events each, with zero frames without visible nodes.
Historical/live recovery, persistent graph DOM identity, retained user camera,
eight tab switches, hidden/visible recovery and desktop/mobile resize checks
passed with no page-runtime errors. The public mobile screenshot was inspected.

Results and screenshots are in `screenshots/ontology-stability/public/`, separate
from the original reproduction, intermediate hidden-dimension diagnosis and
final local checks. This follow-up evidence commit changes only documentation
and verification artifacts; it does not change the verified application code.
