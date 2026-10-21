import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { appendDataRecord, changedMappingRows, mappingRows, recordExport, recordLimit, snapshotFingerprint } from '../src/ontology/lineage.ts';
import { buildSemanticGraph } from '../src/ontology/model.ts';
import { conditionPrediction, conditionState, operatingOutput } from '../src/model/operating.ts';
import { rulModel } from '../src/model/xgboost.ts';

const reading = { t: 'Demo tick 000', source: 'auto-simulation', modelVersion: rulModel.version, windSpeed: 8, windDirection: 226, crackMm: 25, crackState: 'C2', ...operatingOutput(8), ...conditionPrediction(8, 25) };
const candidate = { action: 'condition-inspection', label: 'Inspection', type: 'sdt:InspectionProcess', totalCost: 100, residualRiskScore: .2, acceptable: true, costs: [] };
const snapshot = { id: 'session-reading-0', capturedAt: '2026-10-21T12:00:00Z', reading, asset: 'Turbine-01', component: 'Blade-A', serviceState: conditionState(reading), position: { lat: 52.07, lon: -.62, source: 'Chapter 5 replay GPS' }, candidates: [candidate], recommendation: candidate, selectionBasis: 'Test policy', contract: { actual: .98, target: .95, status: 'Reference' } };
const schema = JSON.parse(readFileSync(new URL('../src/data/ontologySchema.json', import.meta.url), 'utf8'));

test('mapping covers ISO entities and DTE responsibilities and links actual projected entity URIs', () => {
  const rows = mappingRows(snapshot), graph = buildSemanticGraph(snapshot);
  for (const layer of ['OME', 'DCDCE', 'DTE', 'UE']) assert.ok(rows.some(row => row.layer === layer));
  for (const responsibility of ['Operation & Management', 'Application & Service', 'Resource Access & Interchange']) assert.ok(rows.some(row => row.responsibility.includes(responsibility)));
  for (const row of rows) assert.equal(row.uri, graph.nodes.find(node => node.id === row.nodeId)?.uri);
  assert.match(rows.find(row => row.id === 'rul').entity, /wt:PseudoRULEstimate/);
  assert.match(rows.find(row => row.id === 'vibration').evidence, /No live accelerometer/);
  assert.match(rows.find(row => row.id === 'contract').evidence, /Static Chapter 5/);
});
test('capture deduplicates identical frames and timestamp-only renders but records new ticks and GPS-only changes', () => {
  const records = appendDataRecord([], snapshot, snapshot.capturedAt);
  assert.equal(appendDataRecord(records, { ...snapshot, capturedAt: 'different-render-time' }, 'later'), records);
  const gps = structuredClone(snapshot); gps.position.lat += .001;
  assert.equal(appendDataRecord(records, gps, 'later').length, 2);
  const tick = structuredClone(snapshot); tick.id += '-next'; tick.reading.t = 'Demo tick 001';
  assert.notEqual(snapshotFingerprint(tick), snapshotFingerprint(snapshot));
  assert.equal(appendDataRecord(records, tick, 'later').length, 2);
});
test('updates compare displayed values and provenance, not invented changes to static contract/registry', () => {
  const before = mappingRows(snapshot), changed = structuredClone(snapshot);
  changed.reading.windSpeed = 9;
  assert.deepEqual(changedMappingRows(mappingRows(changed), before), ['wind']);
  changed.reading.source = 'manual-input'; changed.reading.rulEvidence.featureSource = 'manual-override';
  const updates = changedMappingRows(mappingRows(changed), before);
  assert.ok(updates.includes('vibration') && updates.includes('rul') && updates.includes('crack'));
  assert.ok(!updates.includes('contract') && !updates.includes('registry'));
});
test('records are detached, bounded and retain monotonic sequence after eviction', () => {
  const mutable = structuredClone(snapshot); let records = appendDataRecord([], mutable, 'capture');
  mutable.reading.crackMm = 70; mutable.recommendation.totalCost = 999;
  assert.equal(records[0].snapshot.reading.crackMm, 25); assert.equal(records[0].snapshot.recommendation.totalCost, 100);
  for (let i = 1; i <= recordLimit + 4; i++) records = appendDataRecord(records, { ...snapshot, id: `frame-${i}` }, 'capture');
  assert.equal(records.length, recordLimit); assert.equal(records[0].sequence, recordLimit + 5);
  assert.equal(records.at(-1).sequence, 6);
});
test('manual/imported/model/GPS provenance are independent and missing timestamps remain missing', () => {
  const manual = structuredClone(snapshot); manual.reading.source = 'manual-input'; manual.reading.rulEvidence.featureSource = 'imported-window'; manual.position.source = 'Device GPS';
  let rows = mappingRows(manual);
  assert.match(rows.find(row => row.id === 'vibration').source, /Manual.*imported-window/);
  assert.match(rows.find(row => row.id === 'gps').evidence, /Browser device/);
  manual.reading.rulEvidence.featureSource = 'manual-override'; rows = mappingRows(manual);
  assert.match(rows.find(row => row.id === 'rul').source, /Manual RUL/);
  const record = appendDataRecord([], manual, 'capture')[0];
  assert.equal(record.snapshot.reading.observedAt, undefined);
});
test('exports retain exact snapshots, units, source and schema hash, without attributing overrides to model artifacts', () => {
  const records = appendDataRecord([], snapshot, 'capture');
  const payload = recordExport(records, 'session', schema.sha256);
  assert.equal(payload.ontologySHA256, schema.sha256); assert.equal(payload.activeModelReference.version, rulModel.version);
  assert.deepEqual(payload.records[0].snapshot, snapshot); assert.equal(payload.records[0].rows.find(row => row.id === 'rul').unit, 'pseudo-h');
  assert.ok(!('fingerprint' in payload.records[0])); assert.match(payload.scope, /not raw sensor/);
  const manual = structuredClone(snapshot); manual.reading.rulEvidence.featureSource = 'manual-override';
  assert.equal(recordExport(appendDataRecord([], manual, 'capture'), 'manual', schema.sha256).activeModelReference, undefined);
  const legacy = structuredClone(snapshot); delete legacy.reading.rulEvidence;
  assert.equal(recordExport(appendDataRecord([], legacy, 'capture'), 'legacy', schema.sha256).activeModelReference, undefined);
});
