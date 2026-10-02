"""Validate generated replay against local original files, without retraining."""
import sys,json,hashlib
from pathlib import Path
import numpy as np
root=Path(__file__).resolve().parents[2];source=Path(sys.argv[1]);records=[]
for meta in json.loads((root/'src/cmapss/datasets.json').read_text()):
 ds=meta['dataset'];path=root/('src/cmapss/replay.json' if ds=='FD001' else f'public/cmapss/data/{ds}.json')
 d=json.loads(path.read_text())
 for name,h in d['files'].items(): assert hashlib.sha256((source/name).read_bytes()).hexdigest()==h
 train=np.loadtxt(source/f'train_{ds}.txt');test=np.loadtxt(source/f'test_{ds}.txt');truth=np.loadtxt(source/f'RUL_{ds}.txt')
 assert len(np.unique(train[:,0]))==meta['trainEngines']; assert len(np.unique(test[:,0]))==meta['testEngines']==len(truth)
 assert len(train)==meta['trainRows'] and len(test)==meta['testRows']
 for e in d['engines']:
  rows=test[test[:,0]==e['id']]
  for p in e['points']:
   row=rows[p['cycle']-1];np.testing.assert_array_equal(row[2:5],p['settings']);np.testing.assert_array_equal(row[[4+n for n in d['sensorNumbers']]],p['sensors'])
  ref=next(t for t in d['evaluation']['truth'] if t['id']==e['id']);assert ref['finalCycle']==rows[-1,1] and ref['finalRUL']==truth[e['id']-1]
 if ds!='FD001':
  audit=json.loads((root/f'docs/cmapss/dataset-evidence/{ds}-endpoints.json').read_text())
  np.testing.assert_array_equal([r['truth'] for r in audit['endpoints']],truth)
  np.testing.assert_array_equal([r['engine'] for r in audit['endpoints']],np.unique(test[:,0]))
 records.append(dict(dataset=ds,trainEngines=meta['trainEngines'],testEngines=meta['testEngines'],sourceHashes='verified',replayObservations='exact match'))
print(json.dumps(dict(status='passed',records=records),indent=2))
