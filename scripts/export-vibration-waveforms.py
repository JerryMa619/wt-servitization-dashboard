"""Export unscaled excerpts from available Chapter 5 simulated vibration archives."""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--data-dir', type=Path, default=ROOT.parent / 'Chapter 5 - Demonstration (Micro Wind Turbine)' / 'data')
args = parser.parse_args()
metadata_path = args.data_dir / 'metadata.csv'
metadata = pd.read_csv(metadata_path)
vibration = metadata[metadata.channel == 'vibration']
available = vibration.apply(lambda row: (args.data_dir / row.state / row.file).exists(), axis=1)
records = []
for (state, wind_bin), group in vibration[available].groupby(['state', 'wind_bin'], sort=True):
    row = group.sort_values('file').iloc[0]
    path = args.data_dir / state / row.file
    frame = pd.read_csv(path)
    fs = int(row.fs_hz)
    assert 'simulated' in str(row.notes).lower(), 'Review source scope before exporting experimental data'
    assert fs == 2000 and np.allclose(np.diff(frame.t), 1 / fs)
    assert np.isfinite(frame[['t', 'ax', 'ay', 'az']].to_numpy()).all()
    excerpt = frame.iloc[:2 * fs]
    stats = {}
    for axis in ['ax', 'ay', 'az']:
        signal = frame[axis].to_numpy()
        centered = signal - signal.mean()
        stats[axis] = {'rms': float(np.sqrt(np.mean(signal ** 2))),
                       'kurtosis': float(np.mean(centered ** 4) / np.std(signal) ** 4)}
    records.append({'id': row.file, 'state': state, 'crackMm': float(row.crack_mm),
                    'windBin': wind_bin, 'windSpeed': float(row.wind_mean_ms), 'sampleRateHz': fs,
                    'fullSampleCount': len(frame), 'excerptSampleCount': len(excerpt),
                    'sourceSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                    'statsScope': 'Full archived acquisition, not current model features', 'stats': stats,
                    'samples': excerpt[['ax', 'ay', 'az']].round(6).to_numpy().tolist()})
assert len(records) == 21, 'Need an available reference for every C0-C6 / wind-bin cell'
manifest = {'version': 'ch5-vibration-reference-1.0', 'scope': 'Archived simulated reference, not live telemetry or model-synchronised waveform',
            'units': 'g', 'excerptSeconds': 2, 'quantizationG': .000001,
            'metadataSha256': hashlib.sha256(metadata_path.read_bytes()).hexdigest(),
            'metadataAcquisitions': len(vibration), 'availableAcquisitions': int(available.sum()),
            'missingAcquisitions': int((~available).sum()), 'referenceAcquisitions': len(records),
            'selection': 'First available filename per state/wind-bin cell; no scaling, noise or resampling',
            'modelSnapshotRelation': 'Archived CSV statistics differ from the bundled 315-row feature snapshot; references are not asserted as inference evidence'}
out = ROOT / 'public/data/vibration-waveforms.json'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps({'manifest': manifest, 'records': records}, separators=(',', ':'), allow_nan=False) + '\n')
audit = ROOT / 'models/vibration/waveform-manifest.json'
audit.parent.mkdir(parents=True, exist_ok=True)
audit.write_text(json.dumps({**manifest, 'artifactSha256': hashlib.sha256(out.read_bytes()).hexdigest(),
                             'records': [{k: v for k, v in record.items() if k != 'samples'} for record in records]}, indent=2) + '\n')
print(json.dumps({**manifest, 'artifactBytes': out.stat().st_size}, indent=2))
