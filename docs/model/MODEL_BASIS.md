# Dashboard Model Basis - Chapter 5 XGBoost

## Evidence Status

The current RUL engine is `ch5-xgb-cqr-2.0`, using Chapter 5's 31 features with a fixed initial prediction of 500 and a window-level calibrated interval. The owner's later request to improve P10/P50/P90 supersedes the initial strict-preservation choice. Original `ch5-xgb-quantile-1.0` sources, fitted models, metrics and parity evidence remain unchanged in `models/chapter5/`. See the [current calibration record](CALIBRATED_XGBOOST.md) and [historical integration record](XGBOOST_IMPLEMENTATION.md).

The target remains synthetic pseudo-hours, `1000 * (1 - crack_mm/80)`, not measured hours-to-failure. Labels (`state`, `crack_mm`, `wind_bin`, `rul_h`) are excluded from inputs. The 315 source windows are partitioned into 189 training, 63 calibration and 63 test rows, stratified by state/wind bin. Deployment uses the training-only trees without a final all-data refit. Metrics are evaluated only on test rows. Repeated windows lack independent blade/session IDs; these internal results do not establish trajectory or field generalisation.

`src/model/operating.ts` is the common scenario entry point; `src/model/xgboost.ts` evaluates the exported trees. Growth, operating response, maintenance effects, policy, economics and heuristic confidence scores remain demonstrations. Architecture mapping does not establish ISO conformity.

GPS and wind direction are site context. No nacelle heading/yaw error, structural geometry, material properties, measured stress cycles, fitted fracture coefficients or fleet failure labels are available. Direction therefore does not currently change modeled vibration/RUL. Power is W (800 W prototype), not utility-scale MW.

## Prediction and Scenario Inputs

Three separate `XGBRegressor` models use `reg:quantileerror`, alpha 0.1/0.5/0.9, 300 estimators, maximum depth 6, learning rate 0.05, seed 42 and `base_score=500` (the midpoint of the defined target domain, not a test-tuned value). Browser raw outputs are verified against native Python predictions, including float32 equality at split thresholds and missing-value branches. No new noise or lifespan labels are invented to make curves move.

Chapter 5 replay and imported JSON windows use the complete ordered 31-feature vector. Automatic growth, repairs and basic manual inputs use training-only state/wind-bin reference mean vectors, interpolated first in wind speed and then crack length. RMS overrides scale the axis RMS/peaks; kurtosis overrides update the three axis kurtoses; modal f1 and RPM override their named features. Derived ratios are recomputed. This is reference-assisted feature construction, not measured signals or a crack estimator. Crack length is used only by this scenario adapter, not passed directly to XGBoost. Spectral and unavailable-axis features are reference context. Wind direction is not an input.

For display/service policy, raw outputs are clipped to the known synthetic 0..1000 target domain and enclosed by their minimum/maximum around P50. A nonnegative CQR-style correction (76.311157 pseudo-h) widens the envelope, then the tails round outward and P50 rounds to the nearest integer. P10/P90 labels denote percentile-based adjusted bounds, not exact calibrated percentiles. Raw outputs, crossing/clipping flag, full vector, calibration radius/scope and out-of-training feature names are retained in history. Reference-assisted or out-of-domain inputs carry no coverage claim. Manual RUL edits remove calibration evidence and remain assumptions. Historical event records are never recalculated; only active, non-manual old-model snapshots with a complete vector are refreshed on reload/import.

Let `v` be wind m/s, `a` crack mm and `d=clamp(a/80,0,1)`. Remaining simulation equations:

- Below 3 m/s or simulated hold: RPM/power zero. Otherwise RPM=round(min(78v,1200)); power=round(min(8.9 v^2.12,800)). Wind domain 0..40; these are demo limits, no OEM cut-out is invented.
Repairs reduce crack, construct a new reference-assisted feature vector and rerun the same XGBoost model. Inspection/prepositioning with zero crack reduction preserve the existing readings and RUL, including imported feature-window outputs. There is no independent lifetime bonus or guaranteed rise in P10 after repair.

On the same 63 held-out windows, the original configuration yields RMSE 76.80 / PICP 100% / MPIW 787.55 pseudo-h. The responsive calibrated engine yields RMSE 72.12 / PICP 90.48% / MPIW 303.85 pseudo-h for a nominal 80% envelope. Raw responsive bounds cover only 60.32%, so narrowing alone would be misleading. Raw crossings remain possible (130/315 supplied vectors), are exposed, and do not become hidden accuracy claims. Service thresholds are unchanged; changed decisions arise from the new predictions, not relaxed policy.

Growth per monitoring tick: clamp(0.16+0.11 max(v-4.5,0)+2.4 max(RMS-0.04,0)+0.34d+0.08(sin(index/8)+1),0.08,1.65) mm. One tick represents 1 modeled monitoring hour. Replay may establish a larger observed crack before repair; repaired/restored state then drives growth. This is not a real detector or physical damage law.

## State and Policy

Classes: C0 [0,10), C1 [10,20), C2 [20,30), C3 [30,45), C4 [45,60), C5 [60,80), C6 at 80 mm. State is the highest severity of:

- Damage: Watch >=20; Degraded >=30; MaintenanceDue >=45; OutOfContract >=80 mm.
- Signal: Watch RMS >0.085 or kurtosis >3.7; Degraded >0.12 or >4.8; MaintenanceDue >0.16 or >6.2.
- RUL: Critical P10 <120; MaintenanceDue <240; Degraded <430; Watch <670; else Nominal.

Candidate sets depend on state/crack/P10. Minimum TCS passing the residual-risk filter wins; no-passing-candidate fallback is explicitly labeled. Inspection/prepositioning remain advisory. Eligible repairs start at crack >=45, P10 <360 or selected residual risk >0.42, subject to cooldown. This is automatic demo policy, not real dispatch or human approval.

| Action | Downtime h | Crack Reduction | Direct GBP | Logistics GBP | Planning Credit GBP | Risk Multiplier |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Inspection | 2 | 0% | 180 | 40 | 0 | 0.92 |
| Spare prepositioning | 1 | 0% | 420 | 280 | 220 | 0.78 |
| Preactive | 4 | 28% | 1250 | 320 | 130 | 0.58 |
| Predictive | 8 | 55% | 2300 | 420 | 280 | 0.35 |
| Proactive | 10 | 62% | 2650 | 520 | 340 | 0.30 |
| Active | 12 | 72% | 3850 | 740 | 120 | 0.22 |
| Corrective | 24 | 100% | 7800 | 1350 | 0 | 0.08 |

All coefficients/effects are assumptions. Residual crack rounded to 0.1 mm; residual P10 uses the common model. Risk index=clamp(0.48 residualCrack/80+0.32 clamp(1-residualP10/900,0,1)+0.13 clamp((preServiceRMS-0.04)/0.18,0,1)+0.07 clamp((v-7)/7,0,1),0.02,0.98), times action multiplier. Pre-service vibration is retained conservatively, not presented as measured post-repair signal.

TCS=direct+logistics-planningCredit+downtime+contractExposure+riskAllowance. Downtime=95 GBP/h plus power(kW)*hours*0.28 GBP/kWh. Contract exposure=42 GBP/h, x1.25 when pre-service P10 <360. Risk allowance=index^2*9800 GBP, not a calibrated expected failure cost. Cost item weights are illustrative, not invoices. Rounded components may differ by 1 GBP from rounded aggregate.

Risk filters: OutOfContract requires residual crack <20/index <0.24; Critical/crack >=60/P10 <240 requires crack <45/index <0.34; crack >=45/P10 <360 requires crack <35/index <0.42; Degraded/crack >=30 requires index <0.56; otherwise <0.72.

## Heuristic Scores

Use normalized 0..1 features `c=clamp(a/80)`, `r=clamp((RMS-0.035)/0.16)`, `k=clamp((kurtosis-2.7)/6.8)`, `f=clamp((27.55-f1)/7)`. Wind penalty 0.08 above 11 m/s, 0.04 above 8, else 0.

- Anomaly=100(0.46c+0.24r+0.20k+0.10f).
- Crack evidence=100 clamp(0.66+0.18c+0.10r+0.08k-windPenalty,0.58,0.98).
- RUL stability=100 clamp(1-(P90-P10)/940-recentP50Range/1200,0.42,0.94), using up to 8 chart readings.
- Decision support=100 clamp(0.42 crackEvidence/100+0.34 stability/100+0.24(1-riskIndex),0.50,0.98).

These are construction-based scores, not accuracy or failure probabilities. Higher severity can raise evidence score. Reload/import starts a short chart window, so stability can change while immutable event evidence stays unchanged. No held-out validation is claimed for these scores; the separate XGBoost window-level validation must not be attributed to them.

## Time, KPI and History

Normal ticks add 1 modeled h. Maintenance compresses planned hours into 2..8 UI ticks; each progress step adds newly elapsed downtime to both the observation horizon and downtime ledger. Completion adds the remaining duration once. Manual scenarios hold the clock. Interruption preserves incurred hours but adds no completion/repair; reload/import closes unfinished work instead of resuming phantom control.

Session availability=1-serviceDowntime/observationHours; pending at zero horizon. Only service downtime is included, not all real unavailability causes. Avoided downtime requires a matched counterfactual and is not estimated. Chapter 5 availability/baseline/horizon/BONUS GBP 520 are fixed references, not current settlement.

Observation/receipt ISO timestamps use a 5 s simulation freshness threshold. Manual/replay and VC1/VC2 are context; missing/future timestamps warn. Browser GPS tracks the user's device, not a physical WT telemetry stream.

Browser-origin history stores latest 30 events, full-horizon totals, latest condition, cursor and held scenario. It is not an authoritative server ledger. Import validates asset, ranges, RUL ordering, event/progress and statistics before replacing state. Exports can contain GPS; review before sharing. No user history is uploaded to GitHub by the dashboard.
