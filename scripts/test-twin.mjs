import test from 'node:test';
import assert from 'node:assert/strict';
import { replayFrames, workflowStage, activeModules, architectureModules, moduleValue } from '../src/twin/model.ts';
import { updateExecutionLog, buildSemanticGraph } from '../src/ontology/model.ts';

const candidate = { action: 'predictive-maintenance', label: 'Predictive maintenance', type: 'sdt:PredictiveMaintenance', totalCost: 3200, residualRiskScore: 0.3, acceptable: true, costs: [] };
const before = { id: 'before', capturedAt: '2026-10-01T20:00:00Z', asset: 'WT-01', component: 'Blade-A', serviceState: 'MaintenanceDue', reading: { t: '20:00', source: 'auto-simulation', windSpeed: 8, windDirection: 220, rpm: 600, power: 800, vibrationRms: 0.12, kurtosis: 4, modalF1: 26, crackMm: 45, crackState: 'C4', rulP10: 200, rulP50: 300, rulP90: 400 }, position: { lat: 52, lon: -1, source: 'Replay GPS' }, recommendation: candidate, candidates: [candidate], selectionBasis: 'Residual-risk policy', contract: null };
const during = { ...structuredClone(before), id: 'during', reading: { ...before.reading, rpm: 0, power: 0, serviceMode: 'in-downtime', elapsedDowntimeH: 4 } };
const after = { ...structuredClone(before), id: 'after', capturedAt: '2026-10-01T20:01:00Z', reading: { ...before.reading, t: '20:01', serviceMode: 'post-service', crackMm: 20, rulP10: 560 }, recommendation: { ...candidate, action: 'condition-inspection', label: 'Inspection' } };
const event = { id: 'service-1', action: candidate.action, label: candidate.label, status: 'completed', downtimeH: 8, before, during: [during], progress: { elapsedH: 8, totalH: 8 }, after };

test('replay uses recorded before, downtime and after evidence without inventing readings', () => {
  const frames = replayFrames(event);
  assert.deepEqual(frames.map((frame) => frame.stage), ['monitor', 'decision', 'downtime', 'result']);
  assert.equal(frames[0].snapshot, before);
  assert.equal(frames[2].snapshot, during);
  assert.equal(frames[2].snapshot.reading.rpm, 0);
  assert.equal(frames[2].elapsedH, 4);
  assert.equal(frames[3].snapshot.reading.crackMm, 20);
  assert.equal(frames[3].elapsedH, 8);
  assert.equal(replayFrames({ ...event, during: undefined, after: undefined }).length, 2);
});

test('workflow follows recorded service mode, not crack class or a cycling clock', () => {
  assert.equal(workflowStage({ ...before, serviceState: 'Nominal', reading: { ...before.reading, crackState: 'C2' } }), 'monitor');
  assert.equal(workflowStage(before), 'decision');
  assert.equal(workflowStage(during), 'downtime');
  assert.equal(workflowStage(after), 'result');
  assert.deepEqual(activeModules('downtime'), ['control', 'execution']);
  assert.ok(!activeModules('result').includes('kpi'));
});

test('progress updates are captured, cloned and idempotent in the shared event log', () => {
  const initial = { ...event, status: 'in-progress', during: [], after: undefined, progress: { elapsedH: 0, totalH: 8 } };
  const log = updateExecutionLog([], initial);
  const updated = updateExecutionLog(log, { ...initial, during: [during], progress: { elapsedH: 4, totalH: 8 } });
  assert.notEqual(updated, log);
  assert.equal(updated[0].during.length, 1);
  assert.equal(updated[0].progress.elapsedH, 4);
  assert.equal(updateExecutionLog(updated, updated[0]), updated);
  const replay = structuredClone(updated[0]);
  updateExecutionLog(updated, event);
  assert.equal(replay.status, 'in-progress');
  assert.equal(replay.after, undefined);
});

test('post-service ontology retains the executed proposal and uses selected frame evidence', () => {
  const graph = buildSemanticGraph(after, event);
  assert.equal(graph.nodes.find((node) => node.id === 'service').title, candidate.label);
  assert.equal(graph.nodes.find((node) => node.id === 'condition').fields[0].value, '20.0 mm');
  assert.equal(graph.nodes.find((node) => node.id === 'recommendation').fields.find((field) => field.label === 'Captured at').value, before.capturedAt);
  assert.equal(graph.nodes.find((node) => node.id === 'condition').fields.find((field) => field.label === 'Captured at').value, after.capturedAt);
  assert.ok(!graph.nodes.some((node) => node.type === 'sdt:ActionAuthorisation'));
});

test('architecture covers ISO sub-entities and marks research-specific modules', () => {
  assert.equal(new Set(architectureModules.map((module) => module.id)).size, 12);
  for (const name of ['Data Collection', 'Device Control', 'Operation & Management', 'Application & Service', 'Resource Access & Interchange']) assert.ok(architectureModules.some((module) => module.subEntity === name), name);
  for (const id of ['state', 'tcs', 'authorisation', 'kpi']) assert.equal(architectureModules.find((module) => module.id === id).extension, true);
  assert.match(moduleValue('control', before, null, 'monitor'), /No physical actuator/);
  assert.match(moduleValue('authorisation', before, event, 'result'), /Not recorded/);
});
