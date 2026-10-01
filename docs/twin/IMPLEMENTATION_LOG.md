# Implementation Record

## 2026-10-01 - Approved prototype

User approved combining the complete DT architecture and process with the existing wind turbine animation. All design, implementation and verification records remain in the existing public GitHub repository.

### Inspection and mapping

Reviewed the current simulation, rotor animation, TCS policy, ontology event store and enhanced static ISO mapping. Checked the NIST reference architecture and Chapter 3 functional extensions. Identified duplicated architecture views and a six-node highlight advancing by clock rather than process state.

### Implementation

1. Added `src/twin/model.ts` for entity / sub-entity mappings, state-derived active paths, evidence values and replay frames.
2. Added `TwinWorkspace.tsx` and `twin.css`: combined physical / digital workspace, architecture switch, node inspection, service loop, CSE band and event replay controls.
3. Moved event ownership to App so ontology and turbine replay share a single latest-30-event store. Captured downtime snapshots, modeled elapsed hours and post-service outcome.
4. Moved simulation side effects out of a React state updater. This avoids advancing mutable service runtime more than once if StrictMode re-evaluates updater functions.
5. Reused rotor smoothing and crack visualization; blade and RUL controls select architecture modules. Display crack length to one decimal place and respect reduced-motion settings.
6. Added selected-frame ontology navigation and Decision Trace-to-turbine replay. Captured proposal / costs remain original even after repair changes the live recommendation.
7. Removed duplicated static architecture and clock-cycling chain. Rearranged supporting panels into map / decision, full-width TCS, and service panels.
8. Added model tests, browser verification, responsive screenshots and pre-deployment model checks.

### Verification and corrections

- TypeScript / production build passed. Existing large-bundle warning remains; no new runtime package added.
- Five ontology and five twin model tests passed.
- First browser pass found a test locator referring to a nonexistent crack metric; corrected to the existing live RUL metric.
- Screenshot review found a group subtitle partly covered by a node; tightened caption spacing while retaining stable node dimensions.
- Final local twin browser checks passed: 12 modules, crack / RUL inspection, matching ontology frame, replay controls, real recorded downtime RPM 0, repaired crack / RUL, continuing live simulation, no runtime errors, no page overflow at 820 / 390 px, reduced-motion behavior and screenshot pixel checks.
- Screenshots and timestamped results: `screenshots/twin/`.

No private project chapter source or downloaded PDF is uploaded as part of this change.

### Publication

- Implementation commit: `30a1c70` (`feat: integrate turbine architecture and recorded service replay`).
- [GitHub Pages deployment 36932817091](https://github.com/JerryMa619/wt-servitization-dashboard/actions/runs/36932817091) completed successfully, including ontology / twin model checks and production build.
- Public browser verification returned HTTP 200 for both [standard](https://jerryma619.github.io/wt-servitization-dashboard/) and [enhanced](https://jerryma619.github.io/wt-servitization-dashboard/enhanced/) routes.
- Both published pages loaded the integrated workspace, 12 architecture modules, RUL inspection / ontology navigation, 50-class schema and downloadable ontology source with no browser runtime errors.
- Timestamped evidence: `screenshots/twin/publication.json` and `screenshots/ontology/publication.json`.
