# Integrated WT / Digital Twin Workspace

## Purpose and sources

Demonstrate the full blade crack / RUL / servitization workflow using the existing turbine animation and simulation. User-approved design: physical asset left, architecture right, service loop below, CSE across the entities; inspect evidence and replay recorded service events without stopping live simulation.

Sources used for the structural mapping:

- [NIST publication on ISO 23247](https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=956967), including the reference architecture entity and sub-entity diagram.
- Project Chapter 3 rewrite, `Chapter 3 - Digital Twin Framework (ISO 23247)/Chapter 3 Rewrite Draft - 2026-06-08/Chapter_3_rewrite_draft.md`, ISO functional mapping and servitization extensions.
- Existing Chapter 4 SDT ontology snapshot and dashboard Chapter 5 dataset / simulation / TCS policy.

This is an ISO-oriented research mapping, not a claim of ISO implementation conformity. Layers are a visual grouping of reference entities, not new ISO layers or OWL inheritance assertions.

## Architecture mapping

| Entity | Sub-entity / role | Dashboard mapping |
| --- | --- | --- |
| OME | Observed physical element | Existing WT animation, blade crack / operating readout, asset and GPS context |
| DCDCE | Data Collection | Wind and vibration observations with source / timestamp |
| DCDCE | Device Control | Simulated hold during maintenance; no real actuator |
| DTE | Operation & Management | Asset context, state synchronisation |
| DTE | Application & Service | Blade condition and RUL; Service State and TCS research extensions |
| DTE | Resource Access & Interchange | Shared evidence records and SDT projection |
| UE | User-facing service / contract workflow | Proposal, missing authorisation, simulated execution, reference contract KPI |
| CSE | Data Translation, Data Assurance, Security Support | Cross-entity band: SDT projection, provenance and explicit unconnected-system boundary |

CSE is not a final serial processing step. Security Support and real Device Control are not implemented by this demonstration. Contract and governance mappings are the project's servitization extensions.

## State and flow

Flow highlights derive from actual recorded mode / policy state, replacing the former six-node clock-cycling highlight:

- Monitoring: acquisition, registration, evidence access, condition and RUL.
- Decision available: monitoring continues, with Service State, TCS and recommendation added.
- Downtime: acquisition/registration/access continue alongside recorded recommendation, execution and simulated hold (RPM / power target zero); no new RUL computation is implied for held pre-service readings.
- Result: execution -> post-service collection, synchronisation, condition, RUL and state refresh; subsequent readings continue monitoring/decision flow.

Highlighting is workflow visualization, not instrumentation proving a model ran at that instant. Recommendation does not prove execution. Dashed authorisation / contract paths remain pending / reference-only. This display fix does not alter `wt-demo-2.0` policy, thresholds or repair effects. Controlled ReactFlow nodes retain measured dimensions through `useNodesState` / `onNodesChange`; new telemetry updates data without resetting node initialization.

## Shared event model and replay

`App` owns the latest 30 locally saved events. Each event contains the original pre-service snapshot and proposal, actual simulator downtime snapshots with elapsed modeled hours, and an optional post-service snapshot. Entries are cloned; subsequent progress does not overwrite original evidence. Ontology and the integrated workspace use this same store. Linked frozen views pin the record and frame so pruning does not remove their provenance.

Starting replay deep-clones the selected record. New live simulator ticks or event-log updates cannot change its timeline. The first two frames show evidence and the captured proposal using the same pre-service observation; they are logical presentation stages, not independently measured timestamps. Subsequent frames use recorded downtime readings, never fabricated interpolation. In-progress events replay only the frames captured when selected; reselect the event to include later progress.

The turbine reuses the existing smooth requestAnimationFrame rotor and crack representation. Targets are driven by the selected frame. During replay, the cost / service proposal remains anchored to `event.before`; physical condition and RUL use the current replay frame. Ontology navigation receives that selected frame, with the executed proposal separately preserved. Live metric cards, maps and charts intentionally continue to show current data outside the historical workspace.

## Layout and interaction

- Default: physical view and continuously visible fixed-coordinate architecture with a detail inspector.
- Explicitly hide overlay: physical view and operating / proposal summary; simulation ticks never toggle the user's display choice.
- Lower band: service, authorisation, execution, modeled downtime and assessment status.
- CSE is a cross-system band below the loop, not an entity in the serial flow.
- Supporting map and service decision share a row; TCS spans the full width; duplicate static architecture and old animated chain removed.
- Mobile stacks physical and digital views. The fixed-format architecture scrolls horizontally inside its container; the page does not overflow.
- Buttons, switches and replay slider have accessible labels; reduced-motion preference stops rotor / CSS flow animations.

## Evidence boundaries

The dashboard model is versioned `wt-demo-2.0` but remains uncalibrated. Live sensor identity, human authorisation, physical command transport, measured maintenance outcome, feedback and live SHACL / OWL reasoning are not supplied. Modeled downtime is compressed; contract KPI is a dataset reference. Enhanced session availability separately uses its saved observation horizon and partial downtime ledger. History survives reload in browser storage and supports validated import/export; unfinished maintenance closes as interrupted on manual replacement or reload, with incurred hours retained and no fabricated repair.

## Verification

- `npm run test:ontology`: source-consistent semantic graph, proposal preservation and bounded event store.
- `npm run test:twin`: recorded replay frames, service modes, progress idempotence, selected-frame ontology and architecture mapping.
- `npm run build`: TypeScript and production bundle.
- `scripts/verify-twin-ui.mjs`: both routes, rotor motion, module selection / details, ontology navigation, desktop / tablet / mobile layout, automatic service completion, frozen replay while live data advances, stopped rotor targets, crack reduction / RUL gain, playback / pause, reduced motion and decoded screenshot pixels.
- Existing ontology browser regression suite remains applicable.
