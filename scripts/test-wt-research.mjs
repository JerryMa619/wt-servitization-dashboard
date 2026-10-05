import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Store } from 'n3';
import SHACLValidator from 'rdf-validate-shacl';
import { Parser } from 'n3';
import { conditionPrediction, conditionState, operatingOutput } from '../src/model/operating.ts';
import { estimateTcs, maintenanceActions, serviceCandidatesForState, serviceDecisionByTcs, isRiskAcceptableAfterAction } from '../src/model/service.ts';
import { rulModel } from '../src/model/xgboost.ts';
import { defaultExperiment, experimentWind, runPolicy, runComparison } from '../src/research/experiments.ts';
import { createWtDataset, executeWtSemantic } from '../src/ontology/wtSemantic.ts';

const reading = { t: 'Test', source: 'auto-simulation', modelVersion: rulModel.version, windSpeed: 8, windDirection: 226, crackMm: 45, ...operatingOutput(8), ...conditionPrediction(8, 45) };
const state = conditionState(reading), selected = serviceDecisionByTcs(reading, state);
const candidates = serviceCandidatesForState(reading, state).map(action => ({ action, label: maintenanceActions[action].label, type: 'sdt:MaintenanceProcess', totalCost: estimateTcs(reading, action).totalCost, residualRiskScore: estimateTcs(reading, action).residualRiskScore, acceptable: isRiskAcceptableAfterAction(reading, estimateTcs(reading, action), state), costs: [] }));
const snapshot = { id: 'test', capturedAt: '2026-10-05T12:00:00Z', asset: 'Turbine-01', component: 'Blade-A', reading, serviceState: state, position: { lat: 52, lon: 0, source: 'Reference' }, candidates, recommendation: candidates.find(c => c.action === selected.action), selectionBasis: 'Dashboard residual-risk filter', contract: null };
const shapes = readFileSync(new URL('../public/ontology/wt-shapes.ttl', import.meta.url), 'utf8');
const query = id => readFileSync(new URL(`../public/ontology/queries/wt-${id}.rq`, import.meta.url), 'utf8');

test('WT RDF actually passes SHACL and joins the original recommendation, features and pseudo-hour unit', async () => {
  const result = await executeWtSemantic(snapshot, shapes, query('evidence'));
  assert.equal(result.conforms, true); assert.equal(result.rows.length, 1); assert.equal(result.rows[0].service, snapshot.recommendation.label);
  assert.equal(result.rows[0].featureSource, 'reference-assisted'); assert.match(result.datasetSHA256, /^[a-f0-9]{64}$/);
  assert.equal((await executeWtSemantic(snapshot, shapes, query('features'))).rows.length, 31);
  assert.equal((await executeWtSemantic(snapshot, shapes, query('candidates'))).rows.length, candidates.length);
});
test('missing units or estimate evidence fail real SHACL and break the evidence query without mutating input', async () => {
  const before = JSON.stringify(snapshot);
  for (const defect of ['missing-unit', 'missing-evidence']) {
    const result = await executeWtSemantic(snapshot, shapes, query('evidence'), defect);
    assert.equal(result.conforms, false); assert.ok(result.violations.length); assert.equal(result.rows.length, 0);
  }
  assert.equal(JSON.stringify(snapshot), before);
});
test('empty graphs, unordered bounds and ineligible recommendations cannot pass structural validation', async () => {
  assert.equal((await new SHACLValidator(new Store(new Parser().parse(shapes))).validate(new Store())).conforms, false);
  const invalid = structuredClone(snapshot); invalid.reading.rulP10 = invalid.reading.rulP90 + 1;
  assert.equal((await executeWtSemantic(invalid, shapes, query('evidence'))).conforms, false);
  const unsafe = structuredClone(snapshot); unsafe.candidates.find(c => c.action === unsafe.recommendation.action).acceptable = false;
  assert.equal((await executeWtSemantic(unsafe, shapes, query('evidence'))).conforms, false);
});
test('manual and legacy estimates do not assert current XGBoost model provenance or physical-hours properties', () => {
  const manual = structuredClone(snapshot); manual.reading.rulEvidence.featureSource = 'manual-override';
  const legacy = structuredClone(snapshot); legacy.reading.modelVersion = 'legacy'; delete legacy.reading.rulEvidence; delete legacy.reading.rulFeatureVector;
  for (const input of [manual, legacy]) {
    const store = createWtDataset(input);
    assert.equal(store.getQuads(null, null, null, null).some(q => q.predicate.value.endsWith('generatedWith')), false);
    assert.equal(store.getQuads(null, null, null, null).some(q => q.predicate.value.startsWith('http://purl.org/sdt/') && /Hours/.test(q.predicate.value)), false);
  }
});
test('shared service defaults preserve existing estimates; efficacy changes rerun the same residual RUL model', () => {
  assert.deepEqual(estimateTcs(reading, 'predictive-maintenance'), estimateTcs(reading, 'predictive-maintenance', undefined, { repairScale: 1, downtimeScale: 1, consequenceScale: 1 }));
  const variant = estimateTcs(reading, 'predictive-maintenance', undefined, { repairScale: .75 });
  assert.equal(variant.residualRulP10, conditionPrediction(reading.windSpeed, variant.residualCrackMm).rulP10);
  assert.ok(variant.residualCrackMm > estimateTcs(reading, 'predictive-maintenance').residualCrackMm);
});
test('four-policy comparison is deterministic, uses the same exogenous wind and leaves live input untouched', () => {
  const config = { ...defaultExperiment }, a = runComparison(config), b = runComparison(config);
  assert.deepEqual(a, b); assert.deepEqual(config, defaultExperiment); assert.equal(a.results.length, 4); assert.equal(a.sensitivity.length, 7);
  assert.deepEqual(a.wind, Array.from({ length: config.horizon + 1 }, (_, h) => experimentWind(config, h)));
});
test('cost ledgers reconcile, time-series ends at horizon, and terminal risk is counted once', () => {
  for (const row of runComparison(defaultExperiment).results) {
    const costs = row.events.reduce((sum, e) => sum + e.directAndLogistics + e.incurredDowntime + e.incurredContract, 0);
    assert.ok(Math.abs(costs - row.incurredCost) < 1e-7); assert.ok(Math.abs(row.cost - row.incurredCost - row.terminalRiskAllowance) < 1e-7);
    assert.equal(row.series.at(-1).hour, defaultExperiment.horizon); assert.equal(row.series.length, defaultExperiment.horizon + 1);
    assert.equal(row.downtimeH, row.events.reduce((sum, e) => sum + e.elapsedH, 0));
  }
});
test('horizon-truncated service charges only elapsed downtime and does not fabricate repair', () => {
  const config = { ...defaultExperiment, horizon: 24, fixedInterval: 20 }, row = runPolicy(config, 'fixed'), event = row.events[0];
  assert.equal(event.elapsedH, 4); assert.equal(event.plannedH, 8); assert.equal(event.completed, false); assert.equal(row.servicesCompleted, 0); assert.equal(row.finalCrack, event.crackBefore);
});
test('all policies share safety ceiling; invalid inputs and unsupported numeric ranges are rejected', () => {
  for (const policy of ['fixed', 'threshold', 'rul', 'tcs']) assert.equal(runPolicy({ ...defaultExperiment, horizon: 24, initialCrack: 80 }, policy).events[0].action, 'corrective-maintenance');
  for (const invalid of [{ horizon: 0 }, { windSpeed: NaN }, { repairScale: 4 }, { fixedInterval: 12.5 }]) assert.throws(() => runComparison({ ...defaultExperiment, ...invalid }));
});
