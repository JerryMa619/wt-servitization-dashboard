# WT Servitization Digital Twin Dashboard

Public dashboard URL: [https://jerryma619.github.io/wt-servitization-dashboard/](https://jerryma619.github.io/wt-servitization-dashboard/)

> Note: this GitHub Pages URL becomes publicly accessible after the dashboard is published from a public GitHub Pages source. The current development repository may remain private, but the deployed site or release repository must be public for open access.

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
- ISO 23247 servitization DT evidence chain visualization.

## Local Development

```bash
npm install
npm run dev
```

Local dashboard:

```text
http://127.0.0.1:5173/
```

## Build

```bash
npm run build
```

The production build is generated in `dist/`.

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
