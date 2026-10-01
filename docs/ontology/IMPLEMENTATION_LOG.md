# Ontology dashboard implementation log

## 2026-10-01: brief and source inspection

Requested by Jerry Ma: implement a first ontology display in the existing WT dashboard and record the work in GitHub.

Audience: PhD demonstration reviewers and dashboard users tracing blade crack evidence to servitization decisions. Delivery: existing React/Vite application and GitHub Pages, on both standard and enhanced routes.

Inspected `src/App.tsx`, the existing enhanced ontology trace, Chapter 4 T-Box, SHACL shapes, rig A-Box and competency-question queries. The existing trace is a runtime summary, not a queried RDF graph. The simulator retained only its latest execution state, so event evidence must be captured before downtime changes the readings.

Design decisions:

- Live Graph: bounded instance graph, labelled directional relationships, stable layout and node inspector.
- Ontology Schema: searchable source-derived classes, superclass definitions and property domains/ranges.
- Decision Trace: bounded session history with frozen pre-service decisions and post-service readings.
- Separate computed predictions, model-derived recommendations, simulated execution and measured evidence.
- Preserve advisory/authorisation/execution distinctions. The simulator does not record a human authorisation, measured intervention assessment or policy update; these remain explicitly absent.
- ISO architecture mappings are dashboard assignments, separate from OWL subclass relations.
- No runtime OWL reasoner, SPARQL endpoint or SHACL engine is claimed.

Source snapshots: `public/ontology/sdt_tbox.ttl`, `sdt_shacl_shapes.ttl` and the source CC BY 4.0 license, copied from the sibling `servitization-digital-twin-ontology` repository. The export script uses N3's Turtle parser and records a SHA-256 fingerprint. Generated schema JSON is committed so normal builds need no ontology service.

Implementation and verification results are appended after the corresponding checks.

## Implementation

1. Snapshotted the Chapter 4 T-Box, SHACL definitions and license. Source repository HEAD: `6ce0dd5bd6aec9e37f45152a102f2973d8ad3adf`.
2. Added N3 as a development-only Turtle parser and a deterministic export/check script. Existing Python environments had no RDFLib, so no Python package installation was needed. Export confirmed 50 classes and 64 native properties.
3. Implemented the typed semantic projection, existing-class service mapping, explicit provenance/source fields and bounded immutable execution-log update.
4. Added Live Graph, Ontology Schema and Decision Trace using existing React Flow and Lucide dependencies. Replaced the former enhanced-only step list; exposed the new module on both routes.
5. Captured simulator evidence before downtime and after completion; added session UUIDs so exported reading/event identifiers do not collide across browser sessions.
6. Added source/model tests to the GitHub Pages workflow and a reproducible browser verification script. Updated README and module design documentation.

## Verification and iteration

- Initial production build passed. Vite reports the existing large application bundle warning; no new runtime graph library was introduced.
- Five targeted model tests passed: native classes/predicates, advisory evidence boundaries, immutable before/after recommendation, deduplicated bounded logs, and class/source mappings.
- `check:ontology` confirmed that the committed JSON matches the Turtle snapshot.
- Browser verification first found no bundled Chromium executable. The installed Google Chrome was used instead; launching it required execution outside the filesystem sandbox. No browser installation was needed.
- First desktop/mobile interaction checks passed, including automatic completion capture and history immutability. Screenshot review found crowded edge labels and cross-node routing.
- Revised graph handles and directional routing, labelled only selected incident relations, added neighborhood focus, and defaulted narrow screens to focus mode. Long class IDs retain their full values in tooltips and the inspector.
- Corrected the Facility UI grouping to the source's actual `OperatingSite`, `ServiceCenter` and `SparePartDepot` classes (there is no native `sdt:Facility` class).
- Desktop and 390 px mobile screenshots and browser verification receipt are versioned in `screenshots/ontology/`. Simulation acceleration is confined to the verification tab.
- Final verification: production build passed; ontology source check passed; 5/5 model tests passed; standard/enhanced route interactions and all three mobile views passed with no module overflow or browser runtime errors.
- Dependency audit reported five advisories in the existing dependency tree (`baseline-browser-mapping`, `browserslist`, `echarts`, `nanoid`, `postcss`), none naming N3. ECharts' available fix is a major-version upgrade. These are recorded for separate dependency maintenance; this ontology change does not apply a forced upgrade.

## GitHub publication

- Feature commit: `c7389ee` (`feat: add interactive ontology and service decision evidence`).
- Design/verification commit: `17bfad8` (`docs: record ontology design, implementation and verification`).
- Pushed both commits to `origin/main` in `JerryMa619/wt-servitization-dashboard`.
- GitHub Pages [run 36919013842](https://github.com/JerryMa619/wt-servitization-dashboard/actions/runs/36919013842) completed successfully, including source/model checks and production build.
- Published-route Chrome verification returned HTTP 200 on both standard and enhanced routes, loaded the ontology module and 50-class browser, downloaded the source T-Box successfully and reported no browser runtime errors. Receipt: `screenshots/ontology/publication.json`.
- Local development server was started at `http://127.0.0.1:5173/`; enhanced route: `http://127.0.0.1:5173/enhanced/`.
- Publication verification script and receipt are committed with this log. Subsequent documentation-only commits use the same Pages workflow.
