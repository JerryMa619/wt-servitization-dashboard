# DT, Ontology and Data-Record Mapping

Date: 2026-10-21.

## Update Process

Implementation started on 2026-10-21; final local verification and the requested
GitHub publication preparation took place on 2026-10-22 (Europe/London).

1. Inspected the existing shared WT snapshot, ISO framework, ontology projection,
   semantic workbench, service-event history and model/source metadata. Kept the
   existing architecture and source classifications rather than adding a separate
   artificial telemetry generator.
2. Added the eleven-row DT/ontology responsibility mapping, per-field source
   inspection and a bounded shared-frame capture buffer. Connected historical
   records to the existing Live Graph and actual semantic workbench.
3. Added immutable records, duplicate-frame suppression, separate WT/capture
   pause, manual capture, JSON/SHA-256 export and reset on session/case changes.
   Added source-aware update indicators without changing model or policy inputs.
4. Added six pure lineage tests and desktop/mobile browser coverage. Initial
   preview/build attempts stalled on local dependency reads. Restored exact
   lockfile dependencies from the local npm cache, without new package versions
   or network installation, and reran the checks.
5. Reviewed the first rendered pages. Clarified simulated control metadata versus
   an asserted execution individual, preserved static KPI provenance, and fixed
   pinned record inspection so buffer eviction cannot silently replace the frame
   being inspected. Marked pinned frames excluded from the current bulk export.
6. Extended browser tests for full buffer capacity, pin retention, real-time graph
   changes and frozen history. Corrected a test timing assumption to wait for
   React's asynchronous first capture after a case switch. Final checks passed
   on standard/enhanced routes and desktop/390/320 px layouts.
7. Updated README, this implementation record and the Pages workflow to run the
   new lineage test suite. Reviewed the included evidence: both service-record
   JSON files contain only isolated Turbine-01 simulations/replay coordinates,
   not a user's persisted session or private Thesis documents.
8. The user requested the complete update process on GitHub. Source, tests,
   documentation, screenshots and simulated evidence are included in the feature
   commit. Deployment/public verification is recorded separately once confirmed.

## Request and Design

Extend the existing standard and enhanced WT dashboards, not a separate replay
with invented sensor measurements. Both new views consume the same
`OntologySnapshot` that feeds WT operation, RUL, policy and Live Graph.

`DT Mapping` is a responsibility-to-representation matrix. OME establishes asset
context; DCDCE maps collection and simulated control responsibilities; DTE maps
Operation & Management, Application & Service, and Resource Access & Interchange;
UE presents advisory services and contract context. Cross-system provenance is
cross-cutting, not a new ISO layer. A functional responsibility need not equal
the layer assigned to a class in the existing graph. The mapping is not an
OWL class-equivalence assertion or a statement of ISO certification.

Eleven rows cover GPS/site, registry, wind, vibration, crack, RUL, service state,
recommendation/TCS, execution context, reference KPI and provenance. Each retains
a projected entity URI, source, units, value and evidence scope. Selecting a row's
ontology representation opens its existing Live Graph node. Snapshot selection,
freeze and historical service frames apply to mapping as well; a historical badge
and return-to-live control prevent historical values from appearing live.

`Data Records` captures accepted shared frames, not a cosmetic independent timer.
Capture remains active across ontology tabs. WT start/pause and capture start/pause
are independent. Manual capture is available while automatic capture is paused.
Identical snapshots, including renders differing only in `capturedAt`, are
deduplicated. New ticks, source changes and GPS-only updates can create records.

## Evidence and Source Rules

- Input origin retains `reading.source`; generated/scenario readings are never
  labelled as connected MC3419 hardware.
- Feature provenance distinguishes reference-assisted, Chapter 5 window,
  imported window, manual override and unavailable legacy metadata.
- RUL includes its recorded version and pseudo-hour unit. The current model
  artifact reference/hash is exported only when a retained record carries that
  version and corresponding non-override model evidence.
- Browser GPS has separate provenance. It is device location, not a turbine
  GPS feed. Replay/manual coordinates remain scenario context.
- Wind direction is context, not a new XGBoost feature.
- The contract KPI remains the static Chapter 5 dataset reference; it does not
  falsely acquire new values as simulated downtime changes.
- Crack growth and repair are existing simulation assumptions. No raw-vibration
  crack detector, physical actuator, human authorisation or measured successful
  intervention is added.
- Live Graph retains the Chapter 4 projection. Mapping explicitly distinguishes
  projected `sdt:RULEstimate` from executable `wt:PseudoRULEstimate`. A captured
  record can enter the existing real RDF/SHACL/SPARQL workbench, but recording
  itself does not assert that a semantic check has run or passed.

## Records, Timing and Export

Records are detached clones with monotonic sequence, browser `recordedAt`, exact
snapshot and per-field mapping. Supplied source `observedAt`, `receivedAt` and
acquisition index are preserved; absent metadata is explicitly unavailable.
Source reading labels may be simulated ticks. UI seconds, modeled service hours
and RUL pseudo-hours are not interchangeable.

The buffer retains the latest 120 frames in browser memory only. Older frames
are discarded, not silently included in an export. Reload clears this buffer;
the pre-existing persisted service-event history is unchanged. New session IDs,
new isolated viva cases and returning to the original session clear the capture
buffer to avoid mixing sessions. Clearing captures does not clear service history
or restart WT. An inspected frame stays immutable while newer records arrive.
One explicitly pinned inspector frame survives buffer eviction; a notice explains
that this out-of-buffer frame is excluded from the bulk export. Returning to
Follow newest releases the pin.

Exports contain `{ payload, payloadSHA256 }`, where the SHA-256 is computed over
UTF-8 `JSON.stringify(payload)`. Payload includes retained records, exact snapshots,
mapping sources, units, original ontology hash and applicable model references.
It is JSON evidence, not a full RDF time-series archive or permanent database.
Captures, exports and semantic checks run locally; no new telemetry upload or
external service is introduced.

Changed indicators compare displayed values and provenance, not render clocks.
An unchanged KPI is not highlighted just because a new simulated tick arrived.
The first captured frame marks all supplied mapping rows as new.

## Implementation and Verification

- `src/ontology/lineage.ts`: pure mapping, capture, diff, deduplication and export.
- `src/ontology/DataLineagePanel.tsx`: mapping, record inspection and export.
- `src/ontology/OntologyPanel.tsx`: shared-session capture, graph changes,
  historical graph/semantic handoff and per-entity source panels.
- `src/App.tsx`: session identity and existing simulation controls only.
- `scripts/test-wt-lineage.mjs`: source mapping, deduplication, changes, immutable
  bounded records, mixed provenance, units and model attribution.
- `scripts/verify-wt-lineage-ui.mjs`: both WT routes, live/historical mapping,
  independent pauses, record export/hash, actual semantic handoff, simulated
  service completion, session isolation, clear and desktop/390/320 px layouts.

Verification results are recorded after checks complete. This change does not
publish a new public version automatically; deployment requires a repository push
and the existing Pages workflow.

## Completed Local Checks

Verified 2026-10-22 (Europe/London):

- All 59 named WT tests passed, including the six new lineage tests and the
  existing model, ontology, framework, vibration, XGBoost and research suites.
- All five separate C-MAPSS assertion suites passed, including actual semantic
  execution and the four-subset audit of 4,835 snapshots.
- Original ontology source check passed: 50 classes and 64 properties.
- TypeScript and production build passed. Existing large-chunk warnings remain.
- Both standard and enhanced routes passed the new browser suite with no page
  runtime errors. The standard route additionally exercised the full 120-record
  capacity and retained a pinned frame after eviction. Live source details changed
  with WT updates; frozen historical details did not.
- JSON export hashes matched recomputed SHA-256 values. Captured simulated
  downtime and post-service frames were present. A captured frame passed actual
  RDF/SHACL/SPARQL execution; no pass was inferred from a visual graph.
- Desktop mapping/record screenshots and mobile 390/320 px views were inspected.
  Tables scroll within their own containers; module/page overflow checks passed.
  Evidence is in `screenshots/wt-lineage/verification.json` and adjacent screenshots
  and isolated simulated-service records.
- `git diff --check` passed. No RUL model artifacts, training data, TCS parameters,
  original ontology files, package versions or package-lock contents were changed.

The initial preview/build attempts stalled on local dependency file reads. The
existing lockfile dependencies were restored with local `npm ci --offline
--ignore-scripts --no-audit --no-fund`; no network install or new package was
needed. Validation was rerun after recovery. Local preview is
`http://127.0.0.1:5173/enhanced/` (standard route `/`). These checks do not claim
that the public Pages version has been updated.

## GitHub Publication Preparation

On 2026-10-22 the user requested publication of the complete update process.
Feature commit `dab1927` contains the WT implementation, tests, screenshots,
simulated records and this chronological account. The fetched remote main was
`40bc726` and contained eight commits newer than the original local baseline,
including already-public C-MAPSS research/evaluation work and viva documents.
Merge commit `3c15853` preserves those changes without rewriting remote history.
The sole conflict was the npm scripts list; all WT and C-MAPSS commands were kept.
No private Thesis files were added by the WT feature commit.

The browser verifier now writes public checks into `screenshots/wt-lineage/public/`
so release evidence does not overwrite local verification. Publication results
and the exact workflow URL are recorded below once confirmed.

After integration, the complete `scripts/test-*.mjs` run passed all 66 reported
tests, including the newer remote C-MAPSS comparison/evaluation suites. TypeScript
and the production build passed again; the existing large-chunk warnings remain.
The diff against remote main contains only the intended WT feature and its
documentation/evidence, with the remote C-MAPSS changes retained.
