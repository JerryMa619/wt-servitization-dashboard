# Three-Axis Vibration Display

## Request and Diagnosis

On 2026-10-02 the owner requested the proposed RMS/kurtosis separation, three-axis display and acceleration waveform. Previously `Blade Vibration` plotted Z RMS and Z kurtosis on one value axis. Their different scales (source Z RMS 0.037..0.057 g versus kurtosis 2.52..2.86) compressed the RMS variation. Z also responds much less to the source crack-state changes than X. Group-mean scenario interpolation further suppresses acquisition fluctuations. Feature trends are window statistics, not the instantaneous acceleration waveform.

The original feature extractor uses `sqrt(mean(signal^2))` RMS and population Pearson kurtosis `mean((signal-mean)^4)/std^4` (normal-distribution reference 3, not excess kurtosis 0). Neither quantity is a stand-alone crack detector; kurtosis is not forced to increase with damage.

## Data Review and Boundaries

- `Chapter 5 - Demonstration (Micro Wind Turbine)/REPLAY_README.md` explicitly identifies the vibration data as simulated, pending a real experimental campaign.
- Metadata lists 315 vibration acquisitions; only 210 corresponding CSVs are available locally. The 105 missing files are disclosed in the manifest and are not regenerated or represented as waveform evidence.
- Select the first available filename in each of 21 C0-C6 / low-mid-high wind cells. Each available CSV has 60000 samples at 2000 Hz (30 s).
- Export the first 4000 samples (2 s) of all three axes, without downsampling, amplitude rescaling or added noise. Round to 6 decimal places only; maximum export error is below 0.0000005 g.
- Full CSV RMS/kurtosis do not exactly match the existing 315-row feature snapshot (e.g. `vib_C0_low_00.csv` X RMS 0.150091 g versus feature snapshot 0.142947 g). Therefore the reference waveform is **not** asserted as the raw acquisition behind the current RUL input. Do not retrain or overwrite the thesis feature snapshot to conceal this mismatch.
- The static asset is `public/data/vibration-waveforms.json`. Source CSV hashes, full-acquisition statistics, metadata hash, missing-file count and asset hash are preserved in `models/vibration/waveform-manifest.json`. No physical sensor is connected.

## Chart Contract

| Surface | Question / Grain | Data | Scale / Encoding | Supported Interpretation |
| --- | --- | --- | --- | --- |
| Blade Vibration RMS | How does window-level strength differ across axes over current history? | Exact named `ax_rms`, `ay_rms`, `az_rms` from each 31-feature vector | g / zero baseline; X solid teal, Y dashed gold, Z dotted pink | Compare axis strength/trend; not instantaneous motion |
| Blade Vibration Kurtosis | How does window-level impulsiveness vary across axes? | Exact named `ax_kurtosis`, `ay_kurtosis`, `az_kurtosis` | Unitless Pearson / explicitly focused scale; same axis encoding | Observe shape statistics; no guaranteed damage monotonicity |
| Blade Acceleration Waveform | What does a selected archived signal segment look like? | Original archived axis samples, 500 consecutive points per view | g versus source-excerpt seconds; symmetric, fixed-per-reference amplitude range | Inspect archived simulated waveform, not current live WT vibration |

The source feature history typically contains 45 initial replay windows. A single held/imported point is a point, not an invented long trend. Missing legacy axes are `null`, not zero or fabricated X/Y reconstructions; gaps are not joined. Trends and waveforms are not curve-smoothed. Tooltips show exact precision/units and remain inside the chart. Axis labels follow Chapter 5's convention, not a measured orientation calibration.

## Integration Decisions

- Top-level `Blade vibration` now shows X/flapwise RMS when available, with an explicit axis label and matching X kurtosis. Legacy fallback is explicitly Z.
- Preserve `vibrationRms` / `kurtosis` as Z compatibility fields. Changing the plotted primary axis does not change service thresholds, crack growth, risk allowance or RUL training. Z input labels are explicit in the scenario form, data-quality row, Framework and ontology.
- Full-feature imports retain all axis values. Reference-assisted scenarios retain their labelled reference construction. Manual overrides still follow the existing model/input provenance rules.
- The waveform chooses nearest archived crack length first, then nearest archived wind value. Its exact source state/wind/filename are shown; no interpolation/scaling is performed on acceleration samples to match current input.
- Replay advances a 0.25 s excerpt view at 100 ms intervals through the stored 2 s buffer, then restarts explicitly as a looped excerpt. It never joins samples across a wrap or different file. Switching reference restarts its source time.
- Native X/Y/Z radio controls, play/pause and JSON download affect only the reference player, not WT condition/history or service accounting. Manual held scenarios pause playback initially; explicit reference preview is possible while the WT clock remains held.
- Simulated downtime or zero RPM suspends playback without claiming a measured zero signal. Reduced-motion defaults to pause; hidden tabs/offscreen panels suspend updates.
- Archive fetch is deferred until the waveform is near the viewport, is cached, and fails with an explicit unavailable state and retry. The 2.55 MB asset is not bundled into the initial JS. Shared lazy chart loading/resize behavior remains in `TelemetryPanel`.
- Layout: wind speed, direction and RUL in a three-column row; RMS/kurtosis in a two-column row and waveform full-width, stacked on mobile. No nested framed charts.

## Reproduction

Export/source verification needs the original archived data directory and the existing Python environment; it does not require XGBoost retraining:

```sh
.venv-xgboost/bin/python scripts/export-vibration-waveforms.py
.venv-xgboost/bin/python scripts/verify-vibration-source.py
npm run test:vibration
npm run test:model
npm run test:ontology
npm run test:twin
npm run test:xgboost
npm run build
```

Both Python commands accept `--data-dir`. They do not modify source CSVs or Chapter 5 outputs. A portable checkout uses the committed excerpt asset; missing original CSVs are not silently regenerated. Source parity verifies all 252000 axis samples within quantisation tolerance and recomputes full-acquisition RMS/kurtosis.

## Verification

42 unit/regression tests pass: 7 vibration, 15 operating/history, 8 XGBoost, 6 ontology and 6 Framework. The source audit verifies 21 references / 252000 axis samples, maximum error `4.999988941073452e-7 g`, unchanged source-file hashes and full-window statistics. The TypeScript/Vite build remains subject to the known large-JS-chunk warning.

Local browser checks cover both standard/enhanced routes, exact unit/axis labels, deferred fetch, nonblank colored-series canvas pixels, actual moving waveform pixels, pause, X/Y/Z switching, excerpt download, hold behavior, unchanged manual WT statistics, reduced motion, failed archive/retry and mobile layout. Responsive screenshots wait for canvas redraw, not only the document width check. Evidence: [browser verification](../../screenshots/vibration/verification.json), [source parity](../../models/vibration/source-parity.json).

Existing browser regressions also pass for full-feature XGBoost import and evidence scope, service-history export/reload/import, manual interruption and held simulation time, pinned repair/ontology evidence, observation freshness, and responsive Framework controls. Evidence: [model checks](../../screenshots/xgboost/verification.json), [workflow checks](../../screenshots/fixes/verification.json).

The player is an inspection aid for existing simulated references. Real waveform-driven crack detection/RUL requires synchronised sensor samples, matched feature extraction and independently reviewed real failure/maintenance outcomes. No physical validation is implied by animated pixels.
