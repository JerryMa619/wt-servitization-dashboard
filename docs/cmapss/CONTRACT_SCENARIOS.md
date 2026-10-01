# Contract comparison (v0.3)

Tracks the approved next step in [Issue #1](https://github.com/JerryMa619/wt-servitization-dashboard/issues/1) and [PR #2](https://github.com/JerryMa619/wt-servitization-dashboard/pull/2).

## Purpose

Demonstrate how unchanged technical evidence can support different advisory choices when service responsibilities and intervention margins change. This version adds two explicit **research assumptions**, not real contracts extracted from NASA data or industry pricing.

| Assumption | Maintenance support | Availability assurance |
| --- | --- | --- |
| Responsibility narrative | Maintenance planning; lower assumed interruption exposure | Higher interruption exposure and earlier intervention margin |
| Failure consequence / baseline maintenance | 5 | 20 |
| Normalized planned-maintenance cost | 1 | 1 |
| Review-lead multiplier | 1 | 1 |
| Lower-RUL intervention margin | 15 cycles | 25 cycles |
| Illustrative cycle-based capacity target | 95% | 99% |
| Assumed planning window | 200 scheduled cycle opportunities | 200 scheduled cycle opportunities |
| Assumed one planned loss | 5 opportunities | 5 opportunities |
| Assumed one unplanned loss | 20 opportunities | 20 opportunities |

These presets instantiate the existing normalized-cost model documented in [DATA.md](DATA.md). They use the same action costs, residual-width normal approximation and eligibility mechanism. The higher failure consequence ratio is an assumed aggregate exposure, not a separately calculated contractual penalty. No new RUL model is fitted.

## Demonstrate / 操作

Open **Service decisions** and use the two example buttons:

- **Show cost-driven example** → Engine 034, cycle **158**. Maintenance support recommends **Continue**; Availability assurance recommends **Enhanced Monitoring**. Both margins are inactive, so the difference comes from consequence costs.
- **Show earlier-intervention example** → Engine 034, cycle **171**. Maintenance support recommends **Enhanced Monitoring**; Availability assurance recommends **Planned Maintenance**. The lower RUL bound (20.139 cycles) lies between 15 and 25, so the stricter margin excludes Continue, Enhanced Monitoring and Inspection.

Example locations are derived by scanning real model snapshots for the first qualifying difference, not synthetic inserted events. The comparator always evaluates both fixed presets against the same selected engine/cycle. Agreement elsewhere is shown as agreement rather than forcing a difference.

Click **Apply** on either contract to synchronize the current policy sliders, summary advice, ontology contract details and exports. Then **Query and validate the applied contract** opens the semantic workbench; choose the contract question and run it. Hand editing any policy control or resetting assumptions detaches the named contract, explicitly reverting to baseline/custom policy. Guide milestones also restore the original baseline. The fixed comparison cards remain unchanged by those custom edits.

**Export contract comparison** records the shared observation/prediction once, both contracts, candidate rankings, budget calculations and provenance. The generic **Export evidence** additionally records the applied contract and its budget when one is active. Neither export claims physical execution or measured KPI results.

## KPI arithmetic and interpretation

Let H be assumed scheduled cycle opportunities, t be the target fraction, and d be an assumed loss of opportunities.

- Allowed loss = (1 − t) × H.
- Capacity proxy under one assumed loss = 1 − d/H.
- Planned-loss budget margin = allowed loss − assumed planned loss.
- Planned loss fits if assumed planned loss ≤ allowed loss (a small numerical tolerance handles floating-point equality).

The two allowed losses are **10** and **2**. One assumed planned loss of 5 yields **97.5%** in either scenario and margins **+5** and **−3**. The stricter scenario therefore does not accommodate that assumed outage. A one-off unplanned loss of 20 yields 90% in both scenarios. No combination of multiple losses is simulated.

Scheduled cycle opportunities are an assumed planning denominator: C-MAPSS operating cycles do not themselves provide calendar time, scheduled hours or downtime records. This is a **cycle-based capacity budget**, not measured availability or Power-by-the-Hour settlement. A planned-maintenance recommendation cannot establish compliance with the 99% target.

The KPI budget is an explanatory feasibility check and **does not enter the cost optimizer**. The capacity target and intervention margin are independently chosen assumptions; neither is derived from the other. A future contractual optimizer would need an explicit intervention-effect/downtime model and a defensible mapping to the actual KPI basis.

## Semantic integration

Profile version **0.3.0** extends the application vocabulary with `cm:ConfiguredContract` and `cm:CapacityBudget`. The source SDT ontology remains unchanged. A named contract reuses `sdt:Contract` / `sdt:hasKPI` / `sdt:ContractKPI` and `sdt:targetValue`, with explicit `cm:ScheduledCycleOpportunity` units and assumption flags.

RDF includes responsibility, version, policy parameters, target, planning denominator, assumed losses, derived budget/proxies and fit flag. Recommendation IRIs include contract identity/version and KPI assumptions; cost/contract changes preserve the estimate's identity. Only active named contracts add these triples. Baseline/custom snapshots do not fabricate a configured KPI.

The generator rejects a named contract whose policy differs from current sliders. SHACL Core independently checks the relationship: sequence paths from contract to applied-policy parameters must equal the declared contract parameters. It also requires bounded target fractions, positive planning windows, assumption/unit markers and required budget fields. Tests mutate actual RDF to demonstrate failure for policy mismatch and missing target.

`public/cmapss/queries/contract.rq` executes an actual SPARQL query to retrieve this evidence. A structural SHACL pass is not proof of contract compliance or of the arithmetic: budget formulas are checked by model tests; the returned `fits` value is a distinct scenario result. Without an applied named contract, the query correctly returns no rows.

## Validation and reproduction

```sh
npm run test:cmapss:contracts
node --experimental-strip-types scripts/test-cmapss-contracts.mjs --record
npm run test:cmapss:semantic
npm run build
```

Tests cover all 1,233 snapshots without mutating observations, known cost/margin examples, KPI arithmetic and boundary inputs, distinct scenario identities, unchanged estimate identity, detached exports, actual SPARQL values and SHACL rejection of mismatched/missing contract evidence. Reference RDF, reports and machine-readable results are under `docs/cmapss/contract-evidence/`.

Browser checks (Playwright + Chrome):

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs CHROME_EXECUTABLE=/path/to/chrome node scripts/verify-cmapss-contracts-ui.mjs
```

Optional `DASHBOARD_URL` selects the production-preview base. Checks cover both examples, unchanged displayed RUL on policy application, exports, actual semantic results, named-contract detachment and 390/320px layouts. Screenshots are under `screenshots/cmapss-contracts/`.
