# WT Servitization Digital Twin Dashboard

Public dashboard URL: [https://jerryma619.github.io/wt-servitization-dashboard/](https://jerryma619.github.io/wt-servitization-dashboard/)

Enhanced public dashboard URL: [https://jerryma619.github.io/wt-servitization-dashboard/enhanced/](https://jerryma619.github.io/wt-servitization-dashboard/enhanced/)

Local dashboard URL: [http://127.0.0.1:5173/](http://127.0.0.1:5173/)

Enhanced local dashboard URL: [http://127.0.0.1:5173/enhanced](http://127.0.0.1:5173/enhanced)

The public repository deploys both routes through GitHub Actions. Local URLs are accessible only on the computer running the development server.

## Overview

This dashboard demonstrates a wind turbine servitization digital twin for blade crack detection and RUL-driven service decision-making. It links WT operation data, GPS/site context, wind conditions, blade vibration, crack growth, RUL estimation, service-state classification, automatic service selection, downtime tracking, and Total Cost of Servitization (TCS).

The implementation is aligned with the project theme of digital twinning servitization for high-value assets, using an ISO 23247-inspired evidence chain and an ontology-based data structure.

## Main Features

- WT operation animation with blade crack growth from 0 mm.
- GPS and real site map context.
- Wind speed, wind direction, vibration, crack state, and RUL monitoring.
- Automatic crack detection, RUL recalculation, service selection, downtime simulation, and WT state update.
- Service decision layer for predictive, preactive, proactive, active, and corrective maintenance.
- TCS comparison across service strategies.
- Cost item breakdown for service, downtime, logistics, contract exposure, and residual risk.
- Integrated turbine / ISO 23247 architecture overlay with state-driven flow highlighting.
- Recorded service-event replay synchronizing blade crack, RUL, rotor targets and modeled downtime.
- Interactive ontology instance graph, source-derived class explorer and service decision history on both dashboard routes.

## Ontology Module

The **Ontology & Decision Evidence** section sits below WT operation and TCS/service decision panels. It includes:

- **Live Graph:** select an entity to inspect readings, class mapping, source and directional relationships; focus its neighborhood, freeze a snapshot, choose a historical service event or download its evidence JSON.
- **Ontology Schema:** search the 50 native Chapter 4 classes, browse module groups, direct superclass declarations and applicable SDT properties. T-Box and SHACL source files are downloadable.
- **Decision Trace:** preserve the latest 30 service events in this browser, including original proposals, elapsed downtime, simulated results and explicit interruptions. Reload restores saved history.

The T-Box is a licensed source snapshot, parsed with N3 into `src/data/ontologySchema.json`. The instance graph is a dashboard projection, not SPARQL query or OWL reasoner output. SHACL definitions are available but live SHACL validation is not executed. Human authorisation, measured intervention assessment and model/policy feedback are not supplied by the simulator and remain explicitly unconfirmed. ISO entity labels are dashboard mappings, separate from OWL class inheritance. Cost values come from the existing TCS model, not native SDT cost properties.

Design, implementation, changes and validation evidence: [implementation log](docs/ontology/IMPLEMENTATION_LOG.md), [module specification](docs/ontology/DESIGN.md), [interaction verification](screenshots/ontology/verification.json), [public deployment verification](screenshots/ontology/publication.json).

![Ontology graph](screenshots/ontology/live-desktop.png)

## Integrated Digital Twin Workspace

Both routes now start with **WT Operation & Digital Twin**. The default view keeps the existing animated turbine alongside live operating evidence and the current service proposal. Turn on **Architecture overlay** to inspect OME, DCDCE, DTE, UE and the cross-system CSE band. DTE separates Operation & Management, Application & Service, and Resource Access & Interchange. Service-state, TCS, authorisation and contract modules are marked as research extensions, not additional ISO-mandated entities.

Select the blade or **RUL evidence** to highlight the matching architecture module. Node details link to the ontology evidence, and the live TCS link opens the comparison section. Once an automatic intervention is recorded, choose it from the event selector or use **Replay on turbine** in Decision Trace. Step, play or pause the recorded pre-service, downtime and post-service snapshots; **Return to live operation** restores current readings. The rest of the dashboard remains live during replay, clearly separated from the historical workspace.

Replay uses the same bounded session event store as ontology. Original intervention costs / recommendation are preserved even when post-service readings imply a new recommendation. Downtime hours are compressed model time, not elapsed real hours. The replay is a recorded simulation walkthrough, not a measured execution trace or engine performance profile. Authorization, physical actuation and measured outcome assessment are not connected. Contract KPI remains a Chapter 5 dataset reference. Manual scenarios still use the existing input window and do not auto-execute services.

Design and process record: [workspace specification](docs/twin/DESIGN.md), [implementation log](docs/twin/IMPLEMENTATION_LOG.md), [browser verification](screenshots/twin/verification.json), [public verification](screenshots/twin/publication.json).

![Integrated architecture](screenshots/twin/architecture-desktop.png)

## Audit Repairs and Model Scope

The history toolbar exports/imports validated JSON and clears local history with confirmation. Unfinished work is closed as interrupted on reload or manual replacement; partial downtime is retained, with no fabricated repaired result. Localhost and public Pages have separate browser-origin histories. No personal event/GPS history is automatically sent to GitHub.

Manual, auto and post-service calculations now share `wt-demo-2.0`. Model Heuristic Scores are not accuracy probabilities; P10/P50/P90 are uncalibrated bounds. Enhanced KPI separates current simulation availability from Chapter 5 references; avoided downtime remains unestimated without a counterfactual.

Process and equations: [repair log](docs/fixes/IMPLEMENTATION_LOG.md), [model basis](docs/model/MODEL_BASIS.md), [browser results](screenshots/fixes/verification.json). Real sensing/control, approval, measured effect and live SHACL remain pending.

## Local Development

```bash
npm install
npm run dev
```

Local dashboard:

```text
http://127.0.0.1:5173/
http://127.0.0.1:5173/enhanced
```

## Build

```bash
npm run build
```

The production build is generated in `dist/`.

## Ontology Verification

Use Node.js 22.6 or later for the TypeScript model tests (the deployment workflow uses Node 22):

```bash
npm run sync:ontology
npm run check:ontology
npm run test:ontology
npm run test:twin
npm run test:model
npm run build
```

`sync:ontology` rebuilds the committed schema from `public/ontology/sdt_tbox.ttl`. `check:ontology` fails if the source and generated schema disagree. Graph/model tests verify known classes and predicates, immutable before/after evidence, bounded event storage and advisory status. Both checks run before Pages deployment.

Browser verification requires Playwright and a Chromium browser. With Playwright available in the environment and the local dev server running:

```bash
node scripts/verify-ontology-ui.mjs
node scripts/verify-twin-ui.mjs
node scripts/verify-fixes-ui.mjs
```

Environment variables: `PLAYWRIGHT_MODULE` (absolute installed Playwright module path), `CHROME_EXECUTABLE` (browser executable), and optional `DASHBOARD_URL` (default `http://127.0.0.1:5173/`). The repair verification script uses the first two variables; other browser scripts can use a normally installed Playwright package. Results are saved under `screenshots/ontology/`, `screenshots/twin/` and `screenshots/fixes/`. Tests accelerate only the simulator in isolated tabs; normal application timing is unchanged.

`node scripts/verify-ontology-publication.mjs` checks the public standard/enhanced routes, ontology browser and source download using the same optional browser environment variables. Its default URL is the GitHub Pages site; results are written to `screenshots/ontology/publication.json`.

`node scripts/verify-fixes-publication.mjs` checks deployed history tools, architecture reachability, deferred charts and enhanced model/KPI scope. Results: `screenshots/fixes/publication.json`.

## Data

Dashboard data is stored in `src/data/dashboardData.json`. The Chapter 5 data sync script is:

```bash
npm run sync:data
```

## Deployment

The repository includes a GitHub Pages workflow at:

```text
.github/workflows/deploy-pages.yml
```

The Vite production base path is configured for:

```text
/wt-servitization-dashboard/
```
