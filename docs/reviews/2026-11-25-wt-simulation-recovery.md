# WT Simulation Recovery at a Held 26.5 mm Reading

## Request and Scope

On 25 November 2026 the user reported that the [enhanced public dashboard](https://jerryma619.github.io/wt-servitization-dashboard/enhanced/) remained at 26.5 mm crack length and could not dynamically demonstrate service decisions. This investigation inspected the current code and isolated public-browser sessions. It did **not** inspect, clear or upload the user's actual browser-local session, so the precise state of that particular incident is not established.

## Observed Baseline

The existing model has no 26.5 mm stop rule. An unpaused fresh public session progressed from 0 to 2.1 mm over nine sampled observations, with cursor 0 to 7. A separately seeded automatic session at 26.5 mm progressed beyond that value and completed two simulated services. No runtime page errors occurred in these cases.

An independent manual / pause reproduction did stop at 26.5 mm after the old **Resume simulation** command. The page switched from manual mode to the automatic source label but remained globally paused. The final sampled crack remained 26.5 mm. Evidence: [baseline observations](../../screenshots/simulation-recovery/baseline-public.json) and [before-fix workspace](../../screenshots/simulation-recovery/before-fix-held-26-5.png). These are generated test sessions, not recovered user or physical measurements.

### Mechanism

The simulator exits each tick when either `manualPointRef.current` or `pausedRef.current` is set. The previous header resume callback cleared only the manual field. In addition, the Play/Pause control and Data Records control considered only `simulationPaused`, even when a restored manual scenario independently prevented all ticks. The framework could still display `LIVE VIEW` in a held or paused state. Historical framework replay and frozen ontology evidence are separate intentional fixed-frame states.

Opening Semantic Check also intentionally pauses WT simulation while freezing evidence. This existing behavior remains; returning to live operation now has an explicit complete recovery command.

**Superseded later on 25 November 2026:** [WT Semantic Questions v1](../ontology/SEMANTIC_QUESTIONS.md) removes that implicit pause. Entering the panel and executing queries now preserve running/paused state. Each answer captures its own evidence in a worker without freezing the global DT. The recovery fixes and the historical test record below remain applicable.

## Changes

- `App.resumeSimulation()` releases both manual hold and global pause. It retains the accepted manual reading, unchanged, in the bounded in-memory history and uses that crack length as the starting point for subsequent automatic ticks. `autoPostServiceOverrideRef` prevents an archived crack label from replacing that resumed starting point. New ticks run the existing model and carry their own automatic source and timestamps.
- Header **Resume simulation**, the main Play control and Data Records **Run WT** share that resume path. Ordinary simulation controls do not silently discard a deliberately frozen ontology view.
- The new **Resume live DT** command also returns framework replay and ontology focus to current readings. It does not clear event history, reset simulation statistics, change session identity or resume independently paused data capture.
- Effective manual hold is reflected in Play/Run controls and the toolbar's **Manual scenario held / automatic services paused** status. Framework badges distinguish `HELD SCENARIO`, `PAUSED VIEW`, `EVENT REPLAY` and `LIVE VIEW`.
- No RUL model, crack-growth equation, TCS rule, risk guardrail, repair effect, downtime accounting, ontology schema or physical-control connection was changed. The OME remains Physical WT; data/control demonstration provenance remains explicit.

## Verification

- `node --experimental-strip-types --test scripts/test-*.mjs`: **73 reported tests passed**. The new unit case checks progression beyond 26.5 mm over five wind inputs and five cursor positions, XGBoost recomputation, and unchanged original manual evidence.
- `npm run build`: TypeScript / Vite passed. The existing large-chunk warning remains.
- `scripts/verify-simulation-recovery-ui.mjs` passed against the production preview under its configured `/wt-servitization-dashboard/` base path, on standard and enhanced routes. Header resume, restored-manual Play, Data Records Run WT, and complete live recovery all advanced from 26.5 mm to 27.1 / 27.2 / 27.4 / 27.3 mm respectively in the recorded run.
- Both routes then completed another automatic intervention, with completed services increasing from 2 to 3 and modeled downtime increasing. Monitoring, decision, downtime and result stages were observed. Prior completed events were deep-equal to their captured originals; data-capture pause remained independent; the captured manual 26.5 mm observation remained exportable.
- 390 / 320 px controls had no page overflow. Desktop held/recovered workspaces and mobile controls were visually inspected. Results: [local browser verification](../../screenshots/simulation-recovery/verification.json).
- Existing complete-framework regression passed on both routes, including two service cycles, 13 visible physical/module nodes, stable rotor identity, connected port geometry, replay, global pause and 1024 / 820 / 390 / 320 px navigation: [framework regression](../../screenshots/simulation-recovery/framework-regression.json).
- Existing DT/ontology lineage regression passed on both routes, including immutable/deduplicated records, separate capture/simulation pause, hashed export, frozen/live graph behavior and executed RDF/SHACL/SPARQL: [lineage regression](../../screenshots/simulation-recovery/lineage-regression.json). Unchanged copies of the existing scripts wrote their transient screenshots outside this repository; earlier historical verification folders were not overwritten.

### Local Verification Environment

Initial verification was impeded by unreadable cloud-backed files under `node_modules`, including a Babel implementation file and a Leaflet declaration file. The waiting server/build/test processes were stopped. `npm ci --offline --ignore-scripts --no-audit --no-fund` restored 686 packages from the existing lock/cache; `package.json` and `package-lock.json` are unchanged. The final full suite and build then passed. The interrupted first suite is not counted as a successful run.

Browser verification was moved from the development server to the completed production build to avoid dependency-optimizer reloads. The harness also waits for the existing asynchronous ReactFlow physical-node update before asserting the newly applied crack length. Neither test-environment issue is presented as the cause of the user's public incident.

Staged Git diff checks briefly waited on the local `docs` tree object. Its SHA was confirmed against GitHub; the reads subsequently completed successfully without replacing any Git object or rewriting history.

## Use and Limitations

After loading the updated page, **Resume live DT** is the explicit recovery action for a held input, global pause and historical framework/ontology views. Do not clear local storage as a recovery step. Export any needed in-memory Data Records before reloading; those records were already transient by design. Stored service history remains browser-local, and localhost/public origins have separate stores.

An intentionally paused scenario does not progress until explicitly resumed. Frozen/historical snapshots do not become live merely because the background simulator is running. This repair addresses reproducible control-state ambiguity and incomplete resume behavior, not an inferred physical crack limit or a validated failure-progression model. If the exact user's session still stops while showing an unpaused automatic live view, its visible mode and runtime error evidence are needed for a separate diagnosis.

## Publication

- Application commit: `ed39c80f0e6464458ed4fcac272961b4e532f638`.
- [GitHub Pages deployment 45600950127](https://github.com/JerryMa619/wt-servitization-dashboard/actions/runs/45600950127) completed successfully, including the actual source/model checks, production build and deployment jobs.
- The same recovery script passed on the public standard and enhanced routes. All four controls advanced a held 26.5 mm input to 27.1 / 27.2 / 27.4 / 27.3 mm in the recorded run, and both routes completed a new service cycle (2 -> 3 completed services) with increasing modeled downtime. Completed evidence, manual-record export and independent capture pause checks passed; no runtime page errors were observed.
- [Public verification](../../screenshots/simulation-recovery/public/verification.json) and before/after/mobile screenshots are tracked separately from local evidence.
- The final evidence-only commit changes this record, README links and public verification artifacts, not application code. It skips a redundant CI/deployment run; the deployed application commit and successful CI run above remain the verified code version.
