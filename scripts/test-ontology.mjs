import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSemanticGraph, updateExecutionLog, actionTypes, evidenceSource } from '../src/ontology/model.ts';
import { bladeSensorReference, auxiliaryChannelReferences } from '../src/model/instrumentation.ts';

const schema = JSON.parse(readFileSync(new URL('../src/data/ontologySchema.json', import.meta.url), 'utf8'));
const candidate = { action: 'predictive-maintenance', label: 'Predictive maintenance', type: actionTypes['predictive-maintenance'], totalCost: 3200, residualRiskScore: 0.3, acceptable: true, costs: [{ label: 'Service', value: 2300 }] };
const snapshot = {
  id: 'test-before', capturedAt: '2026-10-01T20:00:00Z',
  reading: { t: '20:00', source: 'auto-simulation', windSpeed: 8, windDirection: 220, vibrationRms: 0.12, kurtosis: 4, modalF1: 26, crackMm: 45, crackState: 'C4', rulP10: 200, rulP50: 300, rulP90: 400 },
  asset: 'Turbine-01', component: 'Blade-A', serviceState: 'MaintenanceDue',
  position: { lat: 52.07, lon: -0.62, source: 'Chapter 5 replay GPS' },
  candidates: [candidate], recommendation: candidate, selectionBasis: 'Test policy', contract: null
};
const execution = { id: 'service-test', action: candidate.action, label: candidate.label, status: 'in-progress', downtimeH: 8, before: structuredClone(snapshot) };

test('all projected SDT types and predicates exist in the source ontology', () => {
  const after = { ...structuredClone(snapshot), id: 'test-after' };
  const graph = buildSemanticGraph(snapshot, { ...execution, status: 'completed', after });
  const classes = new Set(schema.classes.map((cls) => cls.id));
  const properties = new Set(schema.properties.map((property) => property.id));
  for (const node of graph.nodes) if (node.type.startsWith('sdt:')) assert.ok(classes.has(node.type), node.type);
  for (const relation of graph.relations) if (relation.predicate.startsWith('sdt:')) assert.ok(properties.has(relation.predicate), relation.predicate);
  assert.equal(new Set(graph.nodes.map((node) => node.uri)).size, graph.nodes.length);
  for (const relation of graph.relations) {
    assert.ok(graph.nodes.some((node) => node.id === relation.source));
    assert.ok(graph.nodes.some((node) => node.id === relation.target));
  }
});

test('live graph does not assert authorisation, execution or measured outcome', () => {
  const graph = buildSemanticGraph(snapshot);
  assert.ok(!graph.nodes.some((node) => ['sdt:ActionExecution', 'sdt:ActionAuthorisation', 'sdt:InterventionOutcomeAssessment'].includes(node.type)));
  assert.ok(!graph.relations.some((relation) => relation.predicate === 'sdt:governedBy'));
  assert.equal(graph.nodes.find((node) => node.id === 'recommendation').status, 'Advisory');
});

test('sensor names are configuration references, not live device or measured-output claims', () => {
  const graph = buildSemanticGraph(snapshot);
  const sensor = graph.nodes.find((node) => node.id === 'sensor');
  assert.equal(sensor.title, 'Accel 18 Click (MC3419)');
  assert.match(sensor.status, /not connected/);
  assert.ok(sensor.uri.startsWith('urn:wt-dashboard:'));
  assert.notEqual(sensor.uri, bladeSensorReference.uri);
  assert.equal(sensor.fields.find((row) => row.label === 'Reference individual').value, bladeSensorReference.uri);
  assert.match(sensor.fields.find((row) => row.label === 'Reference placement').value, /80% span \/ suction side/);
  assert.match(sensor.fields.find((row) => row.label === 'Device identity').value, /not supplied/);
  for (const row of auxiliaryChannelReferences.slice(0, 2)) {
    assert.ok(graph.nodes.find((node) => node.id === 'environment').fields.some((field) => field.label === row.label && field.value === row.value));
    assert.match(row.value, /model not recorded/);
  }
  assert.ok(!graph.relations.some((relation) => relation.predicate === 'owl:sameAs'));
});

test('completion preserves the original recommendation and before readings', () => {
  const log = updateExecutionLog([], execution);
  const after = structuredClone(snapshot);
  after.id = 'test-after';
  after.reading.crackMm = 20;
  after.recommendation = { ...candidate, action: 'condition-inspection', label: 'Inspection', type: actionTypes['condition-inspection'] };
  const changedBefore = structuredClone(snapshot);
  changedBefore.reading.crackMm = 80;
  const completed = updateExecutionLog(log, { ...execution, before: changedBefore, status: 'completed', after });
  assert.equal(completed.length, 1);
  assert.equal(completed[0].before.reading.crackMm, 45);
  assert.equal(completed[0].before.recommendation.action, 'predictive-maintenance');
  const graph = buildSemanticGraph(completed[0].before, completed[0]);
  assert.equal(graph.nodes.find((node) => node.id === 'service').title, 'Predictive maintenance');
  assert.ok(graph.nodes.some((node) => node.id === 'post-observation'));
  assert.ok(!graph.nodes.some((node) => node.type === 'sdt:InterventionOutcomeAssessment'));
});

test('event log is detached from mutable simulator data, idempotent and bounded', () => {
  const entry = structuredClone(execution);
  let log = updateExecutionLog([], entry);
  entry.before.reading.crackMm = 70;
  assert.equal(log[0].before.reading.crackMm, 45);
  assert.equal(updateExecutionLog(log, execution), log);
  for (let index = 0; index < 35; index++) log = updateExecutionLog(log, { ...execution, id: `event-${index}` });
  assert.equal(log.length, 30);
  assert.equal(log[0].id, 'event-34');
});

test('service labels map only to existing classes and sources remain labelled', () => {
  for (const type of Object.values(actionTypes)) assert.ok(schema.classes.some((cls) => cls.id === type));
  assert.equal(actionTypes['preactive-maintenance'], 'sdt:MaintenanceProcess');
  assert.match(evidenceSource(snapshot.reading), /Simulation/);
  assert.match(evidenceSource({ ...snapshot.reading, source: 'manual-input' }), /Manual/);
});
