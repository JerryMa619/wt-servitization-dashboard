import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as model from '../src/model/operating.ts';
import * as xgboost from '../src/model/xgboost.ts';
import { parseSession, closeRestoredSession, interruptExecution, snapshotBelongsToEvent } from '../src/model/session.ts';
import { actionTypes, buildSemanticGraph } from '../src/ontology/model.ts';

// Exercise the actual App functions without mounting its UI or importing browser assets.
const source = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('App.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ['clamp', 'makePoint', 'refreshActivePrediction', 'restoredPoint', 'restoredManual', 'serviceStateFromCondition', 'crackStateFromMm', 'windBinFromSpeed', 'crackGrowthRate', 'inferCrackFromRul', 'simulateAutoTwinPoint', 'pointFromScenarioForm', 'applyScenarioModel', 'expectedScenarioValues', 'scenarioConflicts', 'outsideRelativeTolerance', 'applyMaintenanceResult', 'serviceDecisionByTcs', 'serviceCandidatesForState', 'isRiskAcceptableAfterAction', 'estimateTcs', 'residualRiskAfterAction', 'cumulativeKpis', 'formatPct', 'formatGbp'];
const parts = ast.statements.filter((node) => ts.isFunctionDeclaration(node) && names.includes(node.name?.text) || ts.isVariableStatement(node) && node.declarationList.declarations.some((decl) => ['maintenanceActions', 'serviceEconomics', 'tcsParameters'].includes(decl.name.getText(ast))));
const js = ts.transpileModule(parts.map((node) => node.getText(ast)).join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const dataset = JSON.parse(readFileSync(new URL('../src/data/dashboardData.json', import.meta.url), 'utf8'));
const context = vm.createContext({ ...model, ...xgboost, dataset, Date, Math, Number });
vm.runInContext(js, context);
const base = { t: '20:00', source: 'auto-simulation', modelVersion: model.modelMetadata.version, windSpeed: 8, windDirection: 220, crackMm: 45, crackState: 'C4', ...model.operatingOutput(8), ...model.conditionPrediction(8, 45) };
const form = { lat: 52, lon: -1, ...base };
const candidate = { action: 'predictive-maintenance', label: 'Predictive maintenance', type: actionTypes['predictive-maintenance'], totalCost: 3200, residualRiskScore: 0.3, acceptable: true, costs: [{ label: 'Service', value: 2300 }] };
const before = { id: 'before', capturedAt: '2026-10-01T20:00:00Z', asset: 'WT-01', component: 'Blade-A', serviceState: 'MaintenanceDue', reading: base, position: { lat: 52, lon: -1, source: 'Replay GPS' }, recommendation: candidate, candidates: [candidate], selectionBasis: 'Residual-risk policy', contract: null };
const after = { ...structuredClone(before), id: 'after', reading: { ...base, crackMm: 20, ...model.conditionPrediction(8, 20) } };
const event = { id: 'service-1', action: candidate.action, label: candidate.label, status: 'in-progress', downtimeH: 8, before, during: [], progress: { elapsedH: 2, totalH: 8 } };
const session = { version: 1, asset: 'WT-01', events: [event], stats: { totalDowntimeH: 2, observationHours: 10, completedServices: 0 }, latest: base, manual: null, cursor: 4, sessionId: 'session-test' };

test('risk takes the highest severity and never drops as crack increases', () => {
  const ranks = ['Nominal', 'Watch', 'Degraded', 'MaintenanceDue', 'Critical', 'OutOfContract'];
  for (const p10 of [10, 200, 400, 600, 900]) {
    let last = 0;
    for (let crackMm = 0; crackMm <= 80; crackMm++) {
      const rank = ranks.indexOf(model.conditionState({ rulP10: p10, crackMm, vibrationRms: 0.05, kurtosis: 3 }));
      assert.ok(rank >= last); last = rank;
    }
  }
  assert.equal(model.conditionState({ rulP10: 10, crackMm: 20, vibrationRms: 0.05, kurtosis: 3 }), 'Critical');
});
test('the empty-replay fallback also uses XGBoost rather than legacy RUL formulas', () => {
  const fallback = context.makePoint(47);
  assert.equal(fallback.modelVersion, xgboost.rulModel.version);
  assert.equal(fallback.rulEvidence.featureSource, 'reference-assisted');
  assert.equal(fallback.crackMm, 0);
  assert.equal(fallback.rulP50, model.conditionPrediction(fallback.windSpeed, 0).rulP50);
});
test('operating bounds and cut-in apply identically in auto, manual and repair paths', () => {
  for (const windSpeed of [0, 1, 2.9, 3, 8, 15, 40]) {
    const auto = context.simulateAutoTwinPoint({ ...base, windSpeed }, base, 1, false);
    const manual = context.pointFromScenarioForm(context.applyScenarioModel({ ...form, windSpeed }, { windSpeed: true }));
    const repair = context.applyMaintenanceResult({ ...base, windSpeed }, 'predictive-maintenance', 8);
    for (const point of [auto, manual, repair]) {
      assert.equal(point.rpm, model.operatingOutput(windSpeed).rpm);
      assert.equal(point.power, model.operatingOutput(windSpeed).power);
      assert.ok(point.power <= 800 && point.rpm <= 1200);
      for (const key of ['rulP10', 'rulP50', 'rulP90', 'vibrationRms', 'modalF1', 'kurtosis']) assert.equal(point[key], model.conditionPrediction(windSpeed, point.crackMm)[key]);
    }
  }
});
test('repair changes crack and recalculates RUL rather than adding artificial RUL gains', () => {
  const repaired = context.applyMaintenanceResult(base, 'predictive-maintenance', 8);
  assert.equal(repaired.crackMm, 20.2);
  assert.equal(repaired.rulP50, model.conditionPrediction(8, repaired.crackMm).rulP50);
  assert.equal(context.applyMaintenanceResult(base, 'condition-inspection', 2).rulP50, base.rulP50);
});
test('TCS residual crack and RUL use the actual repair prediction', () => {
  for (const action of Object.keys(actionTypes)) {
    const estimate = context.estimateTcs(base, action);
    const repaired = context.applyMaintenanceResult(base, action, 8);
    assert.equal(estimate.residualCrackMm, repaired.crackMm);
    assert.equal(estimate.residualRulP10, repaired.rulP10);
  }
});
test('full imported feature windows drive RUL and inspection does not fabricate a new observation', () => {
  const vector = xgboost.chapter5ReplayVectors[150];
  const prediction = xgboost.predictRul(vector, 'imported-window');
  const point = context.pointFromScenarioForm({ ...form, ...xgboost.featureMeasurements(vector), ...prediction }, vector);
  assert.equal(point.rulP50, prediction.rulP50);
  assert.equal(point.rulEvidence.featureSource, 'imported-window');
  const inspected = context.applyMaintenanceResult(point, 'condition-inspection', 2);
  assert.equal(inspected.rulP10, point.rulP10);
  assert.equal(inspected.rulP50, point.rulP50);
  assert.equal(inspected.rulEvidence.featureSource, 'imported-window');
  assert.equal(context.estimateTcs(point, 'condition-inspection').residualRulP10, point.rulP10);
});
test('manual RUL overrides are not labelled as XGBoost predictions', () => {
  const changed = context.applyScenarioModel({ ...form, rulP50: 700 }, { rulP50: true });
  const point = context.pointFromScenarioForm(changed, null, { rulP50: true });
  assert.equal(point.rulEvidence.featureSource, 'manual-override');
  assert.equal(point.rulEvidence.intervalCalibration, undefined);
});
test('new inference refreshes only active old model snapshots, never manual assumptions or event evidence', () => {
  const old = { ...structuredClone(base), modelVersion: 'ch5-xgb-quantile-1.0', rulP10: 250, rulP50: 500, rulP90: 1000 };
  old.rulEvidence.modelVersion = old.modelVersion;
  delete old.rulEvidence.intervalCalibration;
  const legacy = { ...structuredClone(session), latest: old, manual: old };
  assert.doesNotThrow(() => parseSession(JSON.stringify(legacy), session.asset));
  const refreshed = context.restoredManual(old);
  assert.equal(refreshed.modelVersion, xgboost.rulModel.version);
  assert.equal(refreshed.rulP10, xgboost.predictRul(old.rulFeatureVector, old.rulEvidence.featureSource).rulP10);
  assert.equal(old.modelVersion, 'ch5-xgb-quantile-1.0');
  assert.equal(old.rulP10, 250);
  const manual = { ...old, rulEvidence: { ...old.rulEvidence, featureSource: 'manual-override' } };
  assert.equal(context.restoredManual(manual).rulP50, 500);
  assert.equal(context.restoredManual(manual).modelVersion, old.modelVersion);
  assert.deepEqual(session.events, legacy.events);
});
test('KPI ignores legacy point availability and keeps reference delta in its own window', () => {
  const rows = context.cumulativeKpis({ ...base, availabilityPct: 95 }, { totalDowntimeH: 48, observationHours: 1000, completedServices: 6 });
  assert.equal(rows.find((row) => row.label === 'Session availability').value, '95.2%');
  assert.equal(rows.find((row) => row.label === 'Avoided downtime').value, 'Not estimated');
  const reference = rows.find((row) => row.label === 'Chapter 5 availability reference');
  const delta = ((dataset.service.kpiSettlement.actual_availability - dataset.service.validationConditions.VC3_delta_availability.baseline_availability) * 100).toFixed(1);
  assert.ok(reference.note.includes(`delta ${delta} pp`));
  assert.ok(rows.find((row) => row.label === 'Chapter 5 settlement reference').note.includes('not a session settlement'));
});
test('single input bounds, conflicting coupled inputs and RUL ordering are validated', () => {
  assert.deepEqual(model.inputRangeErrors(form), []);
  for (const [key, value] of [['lat', 91], ['windSpeed', -1], ['rulP90', 1201]]) assert.ok(model.inputRangeErrors({ ...form, [key]: value }).length);
  assert.ok(context.scenarioConflicts({ ...form, rulP10: 900 }, {}).length);
  assert.ok(context.scenarioConflicts({ ...form, windSpeed: 0, rpm: 100 }, { rpm: true }).length);
  assert.ok(context.scenarioConflicts({ ...form, windSpeed: 8, rpm: 50 }, { windSpeed: true, rpm: true }).length);
});
test('freshness distinguishes source context, missing times and aged simulation observations', () => {
  const now = Date.parse('2026-10-01T20:00:10Z');
  assert.equal(model.readingFreshness({ source: 'manual-input' }, now).status, 'context');
  assert.equal(model.readingFreshness({ source: 'VC1' }, now).status, 'context');
  assert.equal(model.readingFreshness({ source: 'auto-simulation' }, now).status, 'warn');
  const reading = { source: 'auto-simulation', observedAt: new Date(now - 1000).toISOString(), receivedAt: new Date(now - 500).toISOString() };
  assert.equal(model.readingFreshness(reading, now).status, 'pass');
  assert.equal(model.readingFreshness(reading, now + 6000).status, 'warn');
  assert.equal(model.readingFreshness({ ...reading, receivedAt: new Date(now + 5000).toISOString() }, now).status, 'warn');
});
test('partial downtime is counted once; completion adds only its remaining duration', () => {
  let stats = model.advanceStats(model.emptyStats(), 8, 0);
  stats = model.advanceStats(stats, 2, 2);
  assert.equal(stats.completedServices, 0);
  assert.equal(model.simulationAvailability(stats), 0.8);
  const interrupted = interruptExecution(event, 'Manual input');
  assert.equal(interrupted.status, 'interrupted');
  assert.equal(interrupted.progress.elapsedH, 2);
  assert.equal(interrupted.after, undefined);
  assert.equal(model.simulationAvailability(model.emptyStats()), null);
  stats = model.advanceStats(stats, 6, 6, { action: event.action, at: base.t });
  assert.equal(stats.totalDowntimeH, 8);
  assert.equal(stats.observationHours, 16);
  assert.equal(stats.completedServices, 1);
});
test('saved history round-trips and reload interrupts unfinished work without fabricating repair', () => {
  const restored = closeRestoredSession(parseSession(JSON.stringify(session), session.asset));
  assert.equal(restored.events[0].status, 'interrupted');
  assert.equal(restored.events[0].after, undefined);
  assert.deepEqual(restored.stats, session.stats);
  assert.deepEqual(closeRestoredSession(restored), restored);
  const completed = { ...event, status: 'completed', after };
  assert.equal(interruptExecution(completed, 'Reload'), completed);
});
test('invalid or cross-asset imports and unsupported evidence are rejected', () => {
  for (const invalid of [
    { ...session, asset: 'other' }, { ...session, latest: { ...base, rulP10: 1000 } },
    { ...session, latest: { ...base, crackGrowthRateMmH: 'broken' } },
    { ...session, stats: { ...session.stats, totalDowntimeH: 11 } },
    { ...session, events: [{ ...event, status: 'completed' }] },
    { ...session, events: [{ ...event, before: { ...before, recommendation: { ...candidate, action: 'unknown' } } }] },
    { ...session, events: [event, event] },
    { ...session, latest: { ...base, rulFeatureVector: [1] } },
    { ...session, latest: { ...base, rulEvidence: { ...base.rulEvidence, rawQuantiles: ['bad', 2, 3] } } },
    { ...session, latest: { ...base, rulEvidence: { ...base.rulEvidence, intervalCalibration: { radius: -1, nominalCoverage: .8, scope: 'source-window' } } } },
    { ...session, latest: { ...base, rulEvidence: { ...base.rulEvidence, intervalCalibration: { radius: 1, nominalCoverage: 1.2, scope: 'source-window' } } } },
    { ...session, latest: { ...base, rulEvidence: { ...base.rulEvidence, intervalCalibration: { radius: 1, nominalCoverage: .8, scope: 'field-validated' } } } }
  ]) assert.throws(() => parseSession(JSON.stringify(invalid), session.asset));
  assert.throws(() => parseSession('broken JSON', session.asset));
});
test('selected post-service evidence retains the distinct original proposal inputs', () => {
  const graph = buildSemanticGraph(after, { ...event, status: 'completed', after });
  assert.equal(graph.nodes.find((node) => node.id === 'condition').fields[0].value, '20.0 mm');
  assert.equal(graph.nodes.find((node) => node.id === 'proposal-condition').fields[0].value, '45 mm');
  assert.ok(graph.relations.some((edge) => edge.source === 'recommendation' && edge.target === 'proposal-rul' && edge.predicate === 'prov:wasDerivedFrom'));
  assert.equal(snapshotBelongsToEvent(after, { ...event, after }), true);
  assert.equal(snapshotBelongsToEvent({ ...after, id: 'event-B-after' }, { ...event, after }), false);
});
