# Physical WT in the Complete DT Framework

## User Correction (22 October 2026)

The initial IF-01 / IF-02 implementation was a detached OME / DCDCE strip, and labelled its return endpoint "Simulated WT". The user clarified that OME is the **Physical WT**, and requested connection to the **whole digital twin**, not another standalone two-entity illustration. This implementation supersedes that strip; its previous screenshots remain historical evidence only.

## One Connected Architecture

The actual existing turbine animation is now the `ome` custom node in the same ReactFlow graph as all 12 DCDCE / DTE / UE modules. It is not a second turbine, an image proxy or an unattached OME label. The graph contains the complete directed service cycle:

```text
OME / Physical WT
  -> DCDCE / Data Collection
  -> DTE / Blade condition -> RUL prediction -> TCS & risk selection
  -> UE / Service recommendation -> Service execution
  -> DCDCE / Device Control
  -> the same OME / Physical WT
```

Asset registration / evidence access, the Service State risk input, post-service records and pending governance / reference-KPI branches remain connected to that same topology. No invented direct OME-to-every-module channels bypass DCDCE.

**Entity identity and demonstration status are different facts.** Both acquisition and control terminate at OME / Physical WT. Current data provenance and the unconnected physical-I/O status are shown separately in the toolbar, source fields and control inspector. The architecture depicts the intended physical feedback boundary; it does not claim that this prototype sent a hardware command or measured an intervention outcome.

## Process and Interaction

- IF-01 is an actual graph edge from the turbine's observation handle to Data Collection, rather than a separate visual legend. It remains active during every service stage.
- IF-02 is the returning graph edge from Device Control to that same turbine. Its topology remains visible, with idle dashed styling outside downtime; the feedback path highlights during modeled downtime together with service execution and device control.
- DTE / UE processing keeps the existing state-driven highlights. After repair, the Physical WT observation path continues through synchronisation, condition and RUL updates.
- Edge clicks select the existing acquisition/control inspector. Turbine crack / RUL controls and ontology navigation remain available.
- Historical replay drives the turbine and entire framework from one selected recorded frame. Original service proposal / TCS inputs remain anchored to the event's pre-service evidence.
- The whole architecture scrolls as one surface on narrow screens. Wind / network icon controls reveal Physical WT or the digital core without separating them into different diagrams. Hiding the overlay retains the standalone operation view and summary.

## Implementation and Review

`src/twin/model.ts` now exports the complete typed topology and active framework connections, retaining the existing module-only API. There is no RUL, TCS, repair-policy, event-store or ontology-schema change. The existing measured-dimension preservation is retained, and the physical node has a stable identity so new telemetry does not remount its animation.

The physical and digital entity frames are aligned, with room for all default turbine controls. Expanded instrumentation details can scroll within the physical node without moving graph ports. ReactFlow owns both boundary edges, their markers and geometry; there is no manually positioned cross-panel overlay to drift during scrolling or resizing.

Replaced the obsolete strip browser verifier with `scripts/verify-framework-closed-loop-ui.mjs`. The first verifier pass used nonexistent edge `data-id` attributes and later treated zero-width vertical SVG bounds as hidden; corrected these test assumptions using the installed ReactFlow edge test IDs and actual SVG stroke / length checks. Screenshot review also caught a partly clipped physical evidence control; increased the entity height before the final run.

## Verification

- Full model / ontology / research regression: 72 reported tests passed, including structural closure of the Physical WT-DCDCE-DTE-UE-Physical WT cycle and active-phase edge coverage.
- TypeScript / Vite build passed; the existing large-bundle warning remains.
- Browser checks cover both routes, two completed interventions each, all four stages, one graph containing the actual turbine and all 12 modules, live rotor DOM continuity and post-service motion, paths touching actual source/target ports, boundary-edge inspection, global pause, recorded downtime RPM 0, post-service idle feedback, selected-frame stability, overlay and RUL navigation, reduced motion and nonblank screenshot pixels.
- Responsive checks cover 1024 / 820 / 390 / 320 px, internal whole-graph scrolling, physical / digital reveal controls and no page overflow.
- Evidence: [local results](../../screenshots/framework-closed-loop/verification.json), with desktop, downtime replay and mobile screenshots in the same directory.
- Final local run sampled 522 standard and 521 enhanced frames. Both actual boundary-edge endpoints were within 2.61 screen pixels of their corresponding handle centers, including the marker offset. There were no browser runtime errors, lost framework nodes or rotor remounts.
- The unchanged `verify-wt-lineage-ui.mjs` regression also passed on both routes: live mapping and source drilldown, bounded/deduplicated captures, immutable pinned records, independent capture/WT pause, payload hashes, frozen/live ontology, executable RDF/SHACL/SPARQL, service/downtime records and 390 / 320 px layouts. An identical-SHA copy wrote its transient results outside the repository to preserve earlier historical screenshots.

Only project code, this process record and isolated simulated browser evidence are published. No private thesis or personal session/location records are uploaded. Publication evidence is recorded after deployment.

## Publication

- Application commit: `2c9eb6a491b8cfc6a64961942d2ea0941c8277e2`.
- [GitHub Pages deployment 39697216436](https://github.com/JerryMa619/wt-servitization-dashboard/actions/runs/39697216436) succeeded, including source/model checks and the production build.
- The complete-loop verifier passed on both public routes: 461 standard and 462 enhanced sampled frames, two completed service cycles each, all four workflow phases, the same Physical WT animation without remounting, all 12 digital modules, correctly anchored observation / control edges, replay, pause, narrow-screen navigation and reduced motion. No browser runtime errors.
- [Public results and screenshots](../../screenshots/framework-closed-loop/public/verification.json) are separate from local evidence. This evidence-only publication record does not alter application code.
