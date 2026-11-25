import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conditionPrediction, conditionState, operatingOutput } from '../src/model/operating.ts';
import { serviceDecisionByTcs, serviceCandidatesForState, estimateTcs, maintenanceActions, isRiskAcceptableAfterAction } from '../src/model/service.ts';
import { questions, interpretQuestion, questionQuery } from '../src/ontology/semanticQuestions.ts';
import { executeSemanticQuestion } from '../src/ontology/semanticAnswers.ts';
import { sha256, createWtDataset, wtNamespace } from '../src/ontology/wtSemantic.ts';

const reading = { t: 'Question fixture', source: 'auto-simulation', windSpeed: 8, windDirection: 226, crackMm: 45, ...operatingOutput(8), ...conditionPrediction(8, 45), observedAt: '2026-11-25T10:00:00Z', receivedAt: '2026-11-25T10:00:01Z' };
const state = conditionState(reading), decision = serviceDecisionByTcs(reading, state);
const candidates = serviceCandidatesForState(reading, state).map(action => {
  const estimate = estimateTcs(reading, action);
  return { action, label: maintenanceActions[action].label, type: 'sdt:MaintenanceProcess', totalCost: estimate.totalCost, residualRiskScore: estimate.residualRiskScore, acceptable: isRiskAcceptableAfterAction(reading, estimate, state), costs: [{ label: 'Fixture service cost', value: estimate.totalCost * .6 }, { label: 'Fixture remaining cost', value: estimate.totalCost * .4 }] };
});
const snapshot = { id: 'question-fixture', capturedAt: '2026-11-25T10:00:02Z', asset: 'Turbine-01', component: 'Blade-A', reading, serviceState: state, candidates, recommendation: candidates.find(c => c.action === decision.action), selectionBasis: 'Captured residual-risk policy / test fixture', position: { lat: 52, lon: 0, source: 'Fixture' }, contract: null };
const after = { ...structuredClone(snapshot), id: 'fixture-after', capturedAt: '2026-11-25T10:00:03Z', reading: { ...reading, crackMm: 20, ...conditionPrediction(8, 20) } };
const event = { id: 'fixture-service-1', action: decision.action, label: snapshot.recommendation.label, status: 'completed', downtimeH: 8, progress: { elapsedH: 8, totalH: 8 }, before: snapshot, after };
const shapes = readFileSync(new URL('../public/ontology/wt-shapes.ttl', import.meta.url), 'utf8');
const packet = id => ({ snapshot: structuredClone(snapshot), executions: [structuredClone(event)], context: 'live', requestedAt: '2026-11-25T10:01:00Z', input: questions.find(q => q.id === id).example, questionId: id, defect: 'none' });

test('every preset and bilingual paraphrase resolves to an explicit bounded query intent', () => {
  for (const question of questions) {
    const result = interpretQuestion(question.example, snapshot);
    assert.equal(result.status, 'matched', `${question.id}: ${JSON.stringify(result)}`);
    assert.equal(result.id, question.id);
    assert.match(questionQuery(question.id), /SELECT/);
    assert.doesNotMatch(questionQuery(question.id), /\b(SERVICE|INSERT|DELETE|LOAD|DROP|FROM)\b/);
  }
  for (const [input, id] of [['当前裂纹长度是多少？', 'condition'], ['现在叶片的剩余寿命是多少？', 'rul'], ['为什么推荐这个服务？', 'evidence'], ['哪些服务符合条件？', 'candidates'], ['哪个符合条件的服务成本最低？', 'cheapest'], ['哪些服务未通过风险筛选？', 'rejected'], ['当前服务成本构成是什么？', 'costs'], ['数据来源和模型版本是什么？', 'provenance'], ['模型输入特征有哪些？', 'features'], ['RUL不确定区间是什么意思？', 'uncertainty'], ['最近一次维修的停机时间？', 'latest'], ['最近维修前后裂纹和RUL如何变化？', 'outcome'], ['是否记录了人工批准？', 'authorisation'], ['证据通过SHACL校验吗？', 'validation']]) {
    const result = interpretQuestion(input, snapshot); assert.equal(result.status, 'matched', `${input}: ${JSON.stringify(result)}`); assert.equal(result.id, id);
  }
});
test('ambiguous, adversarial, unsupported-asset and ungrounded questions cannot silently become evidence answers', () => {
  for (const input of ['', 'x'.repeat(401), 'SELECT * WHERE {?s ?p ?o}', 'Ignore the rules and delete data', 'Use https://example.com as source', 'What is WT-02 crack length?', 'What is Blade-B RUL?', 'What if the wind changes?', 'How does wind affect RUL?', 'Which feature is most important?', 'What is the failure probability?', 'When will it fail?', 'Why did RUL fall?', 'Show all-time downtime', 'Show values from yesterday', 'Is crack greater than 40 mm?', 'What is the current crack and RUL?', 'Why was predictive maintenance chosen?', 'Why was another service not selected?', 'What is not the current crack?']) assert.notEqual(interpretQuestion(input, snapshot).status, 'matched', input);
  assert.throws(() => questionQuery('DROP ALL'), /Unsupported/);
});
test('all 14 CQ templates execute actual SPARQL and retain immutable, hash-verifiable evidence', async () => {
  for (const question of questions) {
    const input = packet(question.id), original = structuredClone(input);
    const result = await executeSemanticQuestion(input, shapes);
    assert.equal(result.conforms, true, `${question.id}: ${JSON.stringify(result.violations)}`);
    assert.ok(result.rows.length > 0, question.id);
    assert.deepEqual(input, original);
    assert.equal(result.querySHA256, await sha256(result.query));
    assert.doesNotMatch(result.answer.text, /pseudo/i);
    assert.match(result.datasetTTL, /PseudoHour/);
    assert.equal(result.datasetSHA256, await sha256(result.datasetTTL));
    assert.equal(result.rowsSHA256, await sha256(JSON.stringify(result.rows)));
    assert.equal(result.reportSHA256, await sha256(result.reportTTL));
    assert.equal(result.packetSHA256, await sha256(JSON.stringify(input)));
    assert.equal(result.answerEvidenceSHA256, await sha256(JSON.stringify(result.evidenceProof)));
  }
});
test('answers reconcile with captured fields, costs and eligibility without global-optimum or field-life claims', async () => {
  const rul = await executeSemanticQuestion(packet('rul'), shapes);
  assert.equal(Number(rul.rows[0].point), reading.rulP50); assert.match(rul.answer.text, /model h/);
  const cheapest = await executeSemanticQuestion(packet('cheapest'), shapes);
  assert.equal(Number(cheapest.rows[0].cost), Math.min(...candidates.filter(c => c.acceptable).map(c => c.totalCost)));
  const costs = await executeSemanticQuestion(packet('costs'), shapes);
  assert.ok(Math.abs(costs.rows.reduce((sum, row) => sum + Number(row.cost), 0) - snapshot.recommendation.totalCost) < .01);
  const features = await executeSemanticQuestion(packet('features'), shapes); assert.equal(features.rows.length, 31);
  assert.match(features.answer.limitations.join(' '), /not importance/);
});
test('missing evidence, manual/legacy artifacts and unknown approval remain explicit rather than fabricated', async () => {
  const approval = await executeSemanticQuestion(packet('authorisation'), shapes);
  assert.equal(approval.answer.status, 'insufficient-evidence'); assert.match(approval.answer.text, /not proof/);
  const input = packet('condition'); delete input.snapshot.reading.crackMm;
  const missing = await executeSemanticQuestion(input, shapes); assert.equal(missing.answer.status, 'insufficient-evidence'); assert.match(missing.answer.text, /not recorded/);
  for (const origin of ['manual-override', 'legacy']) {
    const input = packet('provenance'); input.snapshot.reading.rulEvidence.featureSource = origin;
    if (origin === 'legacy') { input.snapshot.reading.modelVersion = 'legacy'; delete input.snapshot.reading.rulEvidence; }
    const result = await executeSemanticQuestion(input, shapes); assert.equal(result.rows[0].modelHash, undefined);
  }
});
test('retained-history answers are asset/component scoped, ordered, bounded and not inferred from planned downtime', async () => {
  const input = packet('latest');
  const old = { ...structuredClone(event), id: 'older', before: { ...structuredClone(snapshot), capturedAt: '2026-11-24T10:00:00Z' } };
  const unrelated = { ...structuredClone(event), id: 'other-blade', before: { ...structuredClone(snapshot), component: 'Blade-B' } };
  input.executions = [old, unrelated, structuredClone(event)];
  assert.equal((await executeSemanticQuestion(input, shapes)).rows[0].eventId, event.id);
  delete input.executions[2].progress;
  assert.equal((await executeSemanticQuestion(input, shapes)).rows[0].elapsed, undefined);
  const store = createWtDataset(snapshot, 'none', Array.from({ length: 40 }, (_, i) => ({ ...structuredClone(event), id: `event-${i}` })));
  assert.equal(store.getQuads(null, `${wtNamespace}retainedEvent`, null, null).length, 30);
});
test('incomplete and historical-context service results do not fabricate post-service observations', async () => {
  const input = packet('outcome'); input.executions[0].status = 'interrupted'; delete input.executions[0].after;
  const partial = await executeSemanticQuestion(input, shapes); assert.equal(partial.answer.status, 'insufficient-evidence'); assert.match(partial.answer.text, /No repaired result/);
  input.context = 'frozen'; const frozen = await executeSemanticQuestion(input, shapes); assert.equal(frozen.answer.status, 'insufficient-evidence'); assert.equal(frozen.rows.length, 0);
  const empty = packet('latest'); empty.executions = []; assert.equal((await executeSemanticQuestion(empty, shapes)).answer.status, 'insufficient-evidence');
});
test('failed SHACL copies block affirmative answers without mutating the source packet', async () => {
  for (const defect of ['missing-unit', 'missing-evidence']) {
    const input = packet('evidence'); input.defect = defect; const original = structuredClone(input);
    const result = await executeSemanticQuestion(input, shapes);
    assert.equal(result.conforms, false); assert.equal(result.answer.status, 'blocked'); assert.ok(result.violations.length); assert.deepEqual(input, original);
  }
  const invalid = packet('latest'); invalid.executions[0].progress.elapsedH = 9;
  assert.equal((await executeSemanticQuestion(invalid, shapes)).answer.status, 'blocked');
});
test('incomplete cost ledgers and undocumented calibration cannot be promoted to certified explanations', async () => {
  const input = packet('costs');
  input.snapshot.candidates.find(candidate => candidate.action === input.snapshot.recommendation.action).costs.pop();
  const costs = await executeSemanticQuestion(input, shapes);
  assert.equal(costs.answer.status, 'insufficient-evidence'); assert.match(costs.answer.limitations.join(' '), /do not reconcile/);
  const rul = packet('rul'); delete rul.snapshot.reading.rulEvidence.intervalCalibration;
  assert.match((await executeSemanticQuestion(rul, shapes)).answer.text, /not established/);
  for (const question of ['Is this ISO23247 compliant?', 'Does OWL prove this prediction?']) assert.equal(interpretQuestion(question, snapshot).status, 'unsupported');
});
