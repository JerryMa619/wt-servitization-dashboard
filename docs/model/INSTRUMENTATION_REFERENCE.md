# Instrumentation Reference Display

## Decision and Scope

Requested on 2026-10-02: add the project's sensor names where appropriate, without cluttering the dashboard. The shared physical view now shows a compact, keyboard-operable disclosure for **Accel 18 Click (MC3419)**. Data Collection holds the primary reference and auxiliary channel types. The existing ontology Sensor node uses the same name and reference metadata; the environment node identifies the wind instruments.

No new panel, device connection, numerical model or sensor-reading source is introduced. A small shared metadata module (`src/model/instrumentation.ts`) keeps the three representations consistent.

## Source Review

Project-relative sources were read locally; full thesis documents are not uploaded to this public repository.

| Source | Supported statement | SHA-256 |
| --- | --- | --- |
| `servitization-digital-twin-ontology/examples/sdt_abox_rig.ttl` | `rig:Accel18-onBlade-A`: Accel 18 Click (MC3419), 80% span; Blade A monitoring and flap-wise acceleration. Deployment description: suction side. | `2bb0301785790846299557ce24a17303c71336b5ddf2e3b7df545bc406f1f238` |
| Chapter 5 `PHASE1_COMMISSIONING_CHECKLIST.md` | Planned MC3419 calibration/mounting; anemometer, wind vane, generator-phase tachometer pulses, generator voltage and load-current shunt. | `c7c10077473a9e32fb5a738388a7abb3c6268e7502e238fcbab4f9e90929133b` |
| Thesis extraction, Appendix D / Table D.2 / PDF p.302 | Explicit individual inventory repeats Accel 18 Click (MC3419) at 80% span. | `f5b1612f69ddcf39937979733e56755ed81f73ef28b1c47015ae6a8bffbdba1d` |

The reference individual is `http://dtservit.org/ontology/rig#Accel18-onBlade-A`. This is configuration provenance, not a claim that a particular live dashboard device is that physical individual. The dashboard Sensor retains its own `urn:wt-dashboard:` URI; no `owl:sameAs` is asserted. Provenance fields remain display metadata, not additional native SDT predicates.

## Deliberate Omissions

- Auxiliary instrument models are not confirmed, so only types/channels are shown. The commissioning checklist is a plan, not proof of installed or calibrated hardware.
- ESP32, Teensy, ADS1115 and Jetson are computing/acquisition hardware, not sensor names; they are not added as sensor nodes.
- Crack length and RUL are replay/model outputs, not direct measurements from dedicated crack/RUL sensors.
- Browser GPS is not evidence of a GPS module installed on the turbine; no hardware name is invented.
- The existing decorative animation dot is not relabelled as a geometrically accurate 80%-span sensor marker. The reference placement is textual.
- Planned ODR/range, device serial ID and calibration are not represented as measured or verified commissioning facts.

## Verification

Focused regression: ontology reference name/placement/identity boundaries, missing auxiliary models, and no `owl:sameAs`. Browser verification covers both standard and enhanced routes, keyboard disclosure, Data Collection, ontology inspection, rotor motion and layout at 1440/1024/390 px. Evidence is written by `scripts/verify-instrumentation-ui.mjs` to `screenshots/instrumentation/`; public checks use its `public/` subdirectory.

Local results: build passed (existing >500 KB chunk warning remains), ontology source check passed (50 classes / 64 properties), and all 23 tests passed (6 ontology, 6 framework, 11 model). Both routes passed the instrumentation browser checks at 1440/1024/390 px. Screenshots were visually inspected. The continuous-framework regression passed two completed services per route, with visible modules, animated flows and resumed rotor motion preserved.

Implementation commit: [`aaa66c1`](https://github.com/JerryMa619/wt-servitization-dashboard/commit/aaa66c1). [Pages deployment 36941316388](https://github.com/JerryMa619/wt-servitization-dashboard/actions/runs/36941316388) passed. Browser verification then passed on both public routes, including all three viewport widths, the ontology reference, auxiliary instruments and rotor motion. Public evidence: [verification JSON](../../screenshots/instrumentation/public/verification.json), with matching screenshots in the same directory. Deployment reported existing action-runtime/runner migration notices, not a build or runtime failure.
