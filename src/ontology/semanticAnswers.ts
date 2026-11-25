import type { OntologyExecution, OntologySnapshot } from './model.ts';
import { executeWtSemantic, sha256, type WtDefect } from './wtSemantic.ts';
import { isQuestionId, questionQuery, questions, questionVersion, type QuestionId } from './semanticQuestions.ts';

export type QuestionPacket = {
  snapshot: OntologySnapshot;
  executions: OntologyExecution[];
  context: 'live' | 'frozen' | 'historical';
  requestedAt: string;
  input: string;
  questionId: QuestionId;
  defect: WtDefect;
};
export type Answer = { status: 'supported' | 'insufficient-evidence' | 'blocked'; text: string; limitations: string[] };
const number = (value: string | undefined) => value != null && Number.isFinite(Number(value)) ? Number(value).toLocaleString('en-GB', { maximumFractionDigits: 3 }) : 'not recorded';
type Execution = Awaited<ReturnType<typeof executeWtSemantic>>;

export function formatSemanticAnswer(id: QuestionId, result: Execution): Answer {
  const limits = ['Captured simulation/reference evidence; not verified hardware measurements.', 'SHACL checks the WT profile, not physical accuracy, global optimality or OWL inference.'];
  if (!result.conforms) return { status: 'blocked', text: 'The evidence fails the WT application profile. No affirmative decision answer is certified for this test copy.', limitations: limits };
  const row = result.rows[0];
  if (!row) return { status: 'insufficient-evidence', text: 'No matching evidence in this captured dataset. This does not establish that the event or fact never existed.', limitations: limits };
  let text = '', incomplete = false;
  switch (id) {
    case 'condition': text = `${row.asset} / ${row.component}: crack ${number(row.crack)}${row.crack == null ? '' : ' mm'}, service state ${row.state}, wind ${number(row.wind)} m/s at ${number(row.direction)} deg, Z RMS ${number(row.rms)} g.`; break;
    case 'rul': text = `Captured lower / P50 / upper: ${number(row.lower)} / ${number(row.point)} / ${number(row.upper)} synthetic model h. Model ${row.model}. ${row.meaning}.`; break;
    case 'uncertainty': text = `${row.meaning}. Lower / P50 / upper: ${number(row.lower)} / ${number(row.point)} / ${number(row.upper)} synthetic model h; not validated physical hours-to-failure.`; break;
    case 'evidence': text = `The captured recommendation is ${row.service}: assumed GBP ${number(row.cost)}, residual-risk index ${number(row.risk)}, eligible = ${row.eligible}. Recorded selection basis: ${row.basis.replace(/\.+$/, '')}. Its linked RUL P50 is ${number(row.point)} synthetic model h.`; limits.push('This is the recorded recommendation and policy trace, not a causal explanation of physical damage or an execution claim.'); break;
    case 'candidates': text = `${result.rows.length} captured candidate(s); ${result.rows.filter(row => row.eligible === 'true').length} marked eligible by the recorded policy. Costs are assumed GBP and risk values are indices, not probabilities.`; break;
    case 'cheapest': text = `${row.service} has the lowest assumed TCS among captured eligible candidates: GBP ${number(row.cost)}, residual-risk index ${number(row.risk)}. Ties are ordered by service name.`; limits.push('Limited to this captured candidate set and recorded eligibility; not a global optimum or independent policy audit.'); break;
    case 'rejected': text = `${result.rows.length} candidate(s) are explicitly marked ineligible in this frame: ${result.rows.map(row => row.service).join(', ')}.`; limits.push('The exact threshold/rule version is not encoded here; an unselected candidate is not necessarily ineligible.'); break;
    case 'costs': {
      const sum = result.rows.reduce((sum, row) => sum + Number(row.cost), 0);
      text = `${row.service}: assumed TCS GBP ${number(row.total)}. Captured cost items sum to GBP ${number(String(sum))}; the largest captured item is ${row.item} at GBP ${number(row.cost)}.`;
      if (Math.abs(sum - Number(row.total)) > .01) { incomplete = true; limits.push('Cost items do not reconcile with the captured total within GBP 0.01; treat this breakdown as incomplete or inconsistent.'); }
      limits.push('Cost items are illustrative modeled estimates, not invoices or measured savings.'); break;
    }
    case 'provenance': text = `Source ${row.source}; feature origin ${row.featureSource}; model ${row.model}. Snapshot ${row.snapshot}, captured ${row.captured}; observed ${row.observed ?? 'not supplied'}, received ${row.received ?? 'not supplied'}. ${row.modelHash ? `P50 artifact SHA-256 ${row.modelHash}.` : 'No active-model artifact link is asserted for this estimate.'}`; break;
    case 'features': text = `${result.rows.length} named feature values are linked to the captured RUL estimate. Feature origin: ${row.source}.`; limits.push('Feature presence is not importance, SHAP attribution, live sensing or a synchronized raw waveform claim.'); break;
    case 'latest': text = `Latest retained event ${row.eventId}: ${row.service}, status ${row.status}. Planned downtime ${number(row.planned)} modeled h; recorded elapsed downtime ${number(row.elapsed)} modeled h. Pre-service capture ${row.beforeTime}.`; limits.push('At most 30 browser-local retained events; not all-time downtime or physical elapsed time.'); break;
    case 'outcome':
      if (!row.afterTime) return { status: 'insufficient-evidence', text: `Latest retained event ${row.eventId} is ${row.status}; no post-service observation is recorded for it. No repaired result is inferred.`, limitations: limits };
      text = `Event ${row.eventId} (${row.status}): crack ${number(row.beforeCrack)} -> ${number(row.afterCrack)} mm; estimated P50 ${number(row.beforeP50)} -> ${number(row.afterP50)} synthetic model h. Before ${row.beforeTime}; after ${row.afterTime}.`;
      limits.push('Recorded simulation before/after difference, not measured repair efficacy or causal life extension.');
      if (row.beforeModel !== row.afterModel) limits.push('Model versions differ; prediction changes cannot be attributed to repair alone.');
      break;
    case 'authorisation': return { status: 'insufficient-evidence', text: `${number(row.records)} ActionAuthorisation instances in this captured export. Human approval cannot be established: authorisation evidence is not supplied by this application profile. This is not proof that approval did not occur.`, limitations: limits };
    case 'validation': text = `Captured snapshot ${row.snapshot} conforms to the executed WT SHACL profile: ${result.triples} triples and ${result.violations.length} violations. Ontology source SHA-256 ${row.ontologyHash}.`; break;
  }
  return { status: incomplete || id === 'condition' && row.crack == null ? 'insufficient-evidence' : 'supported', text, limitations: limits };
}

export async function executeSemanticQuestion(packet: QuestionPacket, shapes: string) {
  if (!isQuestionId(packet.questionId)) throw new Error('Unsupported competency question');
  if (!['live', 'frozen', 'historical'].includes(packet.context)) throw new Error('Unsupported evidence context');
  if (!['none', 'missing-unit', 'missing-evidence'].includes(packet.defect)) throw new Error('Unsupported validation case');
  const captured = structuredClone(packet);
  const query = questionQuery(captured.questionId);
  const historyQuestion = captured.questionId === 'latest' || captured.questionId === 'outcome';
  const events = captured.context === 'live' ? captured.executions : [];
  const executed = await executeWtSemantic(captured.snapshot, shapes, query, captured.defect, events);
  const answer = historyQuestion && captured.context !== 'live'
    ? { status: 'insufficient-evidence' as const, text: 'Historical/frozen frame selected. Retained-history questions require live evidence to avoid mixing later events with an older observation.', limitations: ['Select live evidence explicitly; the captured observation remains unchanged.'] }
    : formatSemanticAnswer(captured.questionId, executed);
  const rowsSHA256 = await sha256(JSON.stringify(executed.rows)), reportSHA256 = await sha256(executed.reportTTL);
  const proof = { questionVersion, questionId: captured.questionId, input: captured.input, context: captured.context, requestedAt: captured.requestedAt,
    query, querySHA256: await sha256(query), snapshotSHA256: executed.snapshotSHA256, datasetSHA256: executed.datasetSHA256,
    shapesSHA256: executed.shapesSHA256, packetSHA256: await sha256(JSON.stringify(captured)), rowsSHA256, reportSHA256, answer };
  return { ...executed, ...captured, questionVersion, canonicalQuestion: questions.find(q => q.id === captured.questionId)!.label,
    answer, querySHA256: proof.querySHA256, packetSHA256: proof.packetSHA256, rowsSHA256, reportSHA256, evidenceProof: proof, answerEvidenceSHA256: await sha256(JSON.stringify(proof)) };
}
export type QuestionResult = Awaited<ReturnType<typeof executeSemanticQuestion>>;
