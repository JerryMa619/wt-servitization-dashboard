# OME / DCDCE Interface Indicators

**Superseded after user clarification:** this record describes the initial detached interface strip. The current implementation embeds the actual **Physical WT** animation in the **complete connected framework**, returning control to the same OME. See [integrated physical / DT loop](INTEGRATED_PHYSICAL_DT_LOOP.md) for the correction and current verification. Previous screenshots below are historical, not the current layout; the old strip verifier has been replaced by `scripts/verify-framework-closed-loop-ui.mjs`.

## Request and Design (22 October 2026)

The integrated workspace showed the OME turbine and the internal DCDCE / DTE / UE workflow, but did not explicitly identify the OME-to-DCDCE boundary. Add two directional interfaces without introducing an extra ISO entity or claiming a physical connection.

The architecture overlay now includes a compact interface strip above the physical / digital workspace. The same interface IDs appear on the corresponding DCDCE modules and in their inspectors. The IDs below are dashboard identifiers, not ISO clause numbers.

| Interface | Direction | Meaning | State |
| --- | --- | --- | --- |
| IF-01 | OME -> DCDCE / Data Collection | Current selected observation frame; wind speed and Z vibration RMS | Available throughout monitoring, decision, downtime and post-service observation |
| IF-02 | DCDCE / Device Control -> OME | Simulation hold command; rotor RPM and power targets set to zero | Active only during modeled downtime; otherwise idle with a dashed return line |

Clicking either lane selects its existing DCDCE module and inspector. This is a navigation link, not a maintenance command. No sensor, actuator acknowledgement, authorisation or new ontology assertion is fabricated.

## Implementation

- `src/twin/model.ts`: pure `omeConnections` projection, driven by the selected frame and workflow stage; no evidence mutation.
- `src/twin/TwinWorkspace.tsx`: directional Lucide arrows, matching IF-01 / IF-02 module identifiers, active/idle styling, source and evidence time. Replay uses the selected historical frame, not current global readings.
- `src/twin/twin.css`: full-width boundary strip, responsive endpoints and labels, directional packet motion, dashed idle return. Reduced motion disables the packet pseudo-element animation.
- `src/App.tsx`: passes the existing global WT pause state into the workspace. Current-frame edge and interface motion now pauses together; event playback remains independently controlled.
- Existing ReactFlow measured-dimension preservation is unchanged. No new dependency or model/policy change.

The hardware boundary remains visible: sensing and actuation are not physically connected. Acquisition is an observation-frame mapping, not a claim that all values are measured. Crack and RUL retain their existing derived/model provenance.

## Verification

- `node --experimental-strip-types --test scripts/test-*.mjs`: 72 reported tests passed, including two new interface tests and existing WT / C-MAPSS checks.
- Production TypeScript / Vite build passed; the existing large-chunk warning remains.
- `scripts/verify-ome-interfaces-ui.mjs`: both standard and enhanced routes, two completed service cycles each, all four workflow stages, module selection, global pause, immutable historical frame, recorded downtime RPM 0, return to idle after repair, overlay hide/show, reduced motion and 820 / 390 / 320 px layouts.
- Final local run sampled 522 standard and 525 enhanced frames, with no control-state mismatch, disappearing measured framework modules or browser runtime error. No page or interface-text overflow at the checked widths.
- Initial browser pass caught an animation accessibility defect: the existing universal reduced-motion rule did not cover the new CSS pseudo-element. Added explicit pseudo-element coverage and reran successfully.
- Screenshots reviewed for the desktop workspace and 320 px interface strip. Evidence: [local browser results](../../screenshots/ome-interfaces/verification.json).

## Publication

Implementation, tests, this process record and isolated browser-generated demonstration screenshots are tracked in the existing GitHub repository. No private thesis, personal location/history, credentials or raw hardware archive is included. Public verification is recorded separately after deployment.

- Implementation commit: `0016b916b91ec8e48c8d4e5abb20f2033fd3aaa1`.
- [GitHub Pages deployment 39695482011](https://github.com/JerryMa619/wt-servitization-dashboard/actions/runs/39695482011) completed successfully, including source/model verification and production build.
- The same browser script passed on both public routes, sampling 461 standard and 482 enhanced frames across two completed service cycles each. Direction, active/idle state, actual framework visibility, global pause, recorded evidence, mobile layout and reduced motion checks all passed, with no browser runtime errors.
- [Public browser results](../../screenshots/ome-interfaces/public/verification.json) and screenshots are tracked separately from local evidence. This publication record does not change application code.
