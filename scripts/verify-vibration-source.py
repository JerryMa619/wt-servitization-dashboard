"""Verify exported excerpts against their original Chapter 5 CSVs, not model features."""
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
payload = json.loads((ROOT / 'public/data/vibration-waveforms.json').read_text())
maximum, compared = 0, 0
for record in payload['records']:
    path = args.data_dir / record['state'] / record['id']
    assert hashlib.sha256(path.read_bytes()).hexdigest() == record['sourceSha256']
    frame = pd.read_csv(path)
    assert np.allclose(np.diff(frame.t), 1 / record['sampleRateHz'])
    original = frame[['ax', 'ay', 'az']].iloc[:record['excerptSampleCount']].to_numpy()
    exported = np.array(record['samples'])
    error = float(np.abs(original - exported).max())
    assert error <= .000000500001
    maximum = max(maximum, error)
    compared += original.size
    for axis in ['ax', 'ay', 'az']:
        signal = frame[axis].to_numpy()
        assert abs(np.sqrt(np.mean(signal ** 2)) - record['stats'][axis]['rms']) < 1e-12
        assert abs(np.mean((signal - signal.mean()) ** 4) / np.std(signal) ** 4 - record['stats'][axis]['kurtosis']) < 1e-12
result = {'references': len(payload['records']), 'comparedAxisSamples': compared,
          'maxQuantizationErrorG': maximum, 'toleranceG': .000000500001,
          'fullAcquisitionStatisticsVerified': True, 'noScalingOrAddedNoise': True,
          'sourceScope': payload['manifest']['scope']}
(ROOT / 'models/vibration/source-parity.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
