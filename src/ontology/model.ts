import { auxiliaryChannelReferences, bladeSensorFields, bladeSensorReference } from '../model/instrumentation.ts';
import { rulDescription, rulUncertaintyDescription, type RulEvidence } from '../model/xgboost.ts';

export type OntologyReading = {
  t: string;
  source?: string;
  observedAt?: string;
  receivedAt?: string;
  modelVersion?: string;
  rulEvidence?: RulEvidence;
  rulFeatureVector?: number[];
  windSpeed: number;
  windDirection: number;
  rpm?: number;
  power?: number;
  vibrationRms: number;
  kurtosis: number;
  modalF1: number;
  crackMm?: number;
  crackState?: string;
  rulP10: number;
  rulP50: number;
  rulP90: number;
  serviceMode?: string;
  serviceAction?: string;
  downtimeH?: number;
  elapsedDowntimeH?: number;
};

export type OntologyCandidate = {
  action: string;
  label: string;
  type: string;
  totalCost: number;
  residualRiskScore: number;
  acceptable: boolean;
  costs: { label: string; value: number }[];
};

export type OntologySnapshot = {
  id: string;
  capturedAt: string;
  reading: OntologyReading;
  asset: string;
  component: string;
  serviceState: string;
  position: { lat: number; lon: number; source: string };
  candidates: OntologyCandidate[];
  recommendation: OntologyCandidate;
  selectionBasis: string;
  contract: { actual: number; target: number; status: string } | null;
};

export type OntologyExecution = {
  id: string;
  action: string;
  label: string;
  status: 'in-progress' | 'completed' | 'interrupted';
  endReason?: string;
  downtimeH: number;
  before: OntologySnapshot;
  during?: OntologySnapshot[];
  progress?: { elapsedH: number; totalH: number };
  after?: OntologySnapshot;
};

export type SemanticNode = {
  id: string;
  uri: string;
  title: string;
  type: string;
  layer: string;
  group: 'asset' | 'evidence' | 'prediction' | 'decision' | 'service' | 'contract';
  status: string;
  fields: { label: string; value: string }[];
  x: number;
  y: number;
};

export type SemanticRelation = { source: string; target: string; predicate: string };
export type SemanticGraph = { nodes: SemanticNode[]; relations: SemanticRelation[] };

export const actionTypes: Record<string, string> = {
  'condition-inspection': 'sdt:InspectionProcess',
  'predictive-maintenance': 'sdt:PredictiveMaintenance',
  'corrective-maintenance': 'sdt:CorrectiveMaintenance',
  'preactive-maintenance': 'sdt:MaintenanceProcess',
  'proactive-maintenance': 'sdt:MaintenanceProcess',
  'active-maintenance': 'sdt:MaintenanceProcess',
  'spare-prepositioning': 'sdt:ServiceProcess'
};

export function evidenceSource(reading: OntologyReading) {
  if (reading.source === 'manual-input') return 'Manual scenario / model-derived';
  if (['auto-simulation', 'auto-service', 'service-action'].includes(reading.source ?? '')) return 'Simulation / model-derived';
  return reading.source ? `Chapter 5 replay: ${reading.source}` : 'Fallback simulation';
}

const field = (label: string, value: string | number) => ({ label, value: String(value) });
const gbp = (value: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value);

export function buildSemanticGraph(snapshot: OntologySnapshot, execution?: OntologyExecution): SemanticGraph {
  const p = snapshot.reading;
  const rec = execution?.before.recommendation ?? snapshot.recommendation;
  const nodes: SemanticNode[] = [];
  const relations: SemanticRelation[] = [];
  function node(id: string, title: string, type: string, layer: string, group: SemanticNode['group'], x: number, y: number, status: string, fields: SemanticNode['fields']) {
    const stable = ['asset', 'blade', 'sensor', 'contract'].includes(id);
    nodes.push({ id, title, type, layer, group, x, y, status, fields, uri: `urn:wt-dashboard:${encodeURIComponent(snapshot.asset)}:${stable ? '' : encodeURIComponent(snapshot.id) + ':'}${id}` });
  }
  function link(source: string, target: string, predicate: string) { relations.push({ source, target, predicate }); }
  const provenance = [field('Evidence source', evidenceSource(p)), field('Captured at', snapshot.capturedAt), field('Reading time', p.t)];
  const proposal = execution?.before ?? snapshot;
  const proposalProvenance = [field('Evidence source', evidenceSource(proposal.reading)), field('Captured at', proposal.capturedAt), field('Reading time', proposal.reading.t)];
  node('asset', snapshot.asset, 'sdt:Asset', 'OME', 'asset', 0, 0, 'Asset context', [field('GPS', `${snapshot.position.lat.toFixed(5)}, ${snapshot.position.lon.toFixed(5)}`), field('GPS source', snapshot.position.source)]);
  node('blade', snapshot.component, 'sdt:Component', 'OME', 'asset', 0, 175, 'Monitored component', [field('Crack length', p.crackMm == null ? 'Unavailable' : `${p.crackMm.toFixed(1)} mm`)]);
  node('sensor', bladeSensorReference.name, 'sdt:Sensor', 'DCDCE', 'asset', 0, 350, 'Rig reference / not connected', [...bladeSensorFields, field('Configuration source', bladeSensorReference.source), field('Reference individual', bladeSensorReference.uri), field('Mapping scope', 'Logical dashboard channel; no live device identity or owl:sameAs assertion')]);
  node('environment', 'Wind and site context', 'sdt:OperatingEnvironment', 'OME', 'evidence', 245, 0, evidenceSource(p), [field('Wind speed', `${p.windSpeed.toFixed(1)} m/s`), field('Wind direction', `${p.windDirection} deg`), ...auxiliaryChannelReferences.slice(0, 2), field('Instrument source', 'Chapter 5 commissioning plan / not live hardware'), ...provenance]);
  node('condition', 'Blade condition', 'sdt:ConditionEvent', 'DTE', 'evidence', 245, 175, p.crackState ?? 'Unclassified', [field('Crack length', p.crackMm == null ? 'Unavailable' : `${p.crackMm.toFixed(1)} mm`), field('Severity', p.crackState ?? 'Unavailable'), ...provenance]);
  node('observation', 'Vibration observation', 'sosa:Observation', 'DCDCE', 'evidence', 245, 350, evidenceSource(p), [field('Z RMS', `${p.vibrationRms.toFixed(3)} g`), field('Z kurtosis', p.kurtosis.toFixed(2)), field('Modal f1', `${p.modalF1.toFixed(2)} Hz`), ...provenance]);
  node('state', snapshot.serviceState, 'sdt:ServiceState', 'DTE', 'decision', 490, 0, 'Dashboard policy result', [field('Policy', 'Highest severity across crack, vibration and RUL'), ...provenance]);
  node('rul', 'Blade RUL estimate', 'sdt:RULEstimate', 'DTE', 'prediction', 490, 175, 'Model estimate', [field('P10 / P50 / P90', `${p.rulP10} / ${p.rulP50} / ${p.rulP90} pseudo-h`), field('Computation', rulDescription(p)), field('Model provenance', p.modelVersion ?? 'Legacy Chapter 5 reference'), field('Uncertainty', rulUncertaintyDescription(p)), ...(p.rulEvidence ? [field('Raw model quantiles', p.rulEvidence.rawQuantiles.map((value) => value.toFixed(4)).join(' / ')), field('Display envelope adjustment', p.rulEvidence.quantileAdjusted ? 'Clipped to 0..1000 and/or ordered around P50; raw outputs retained' : 'No crossing/clipping; raw outputs retained'), ...(p.rulEvidence.intervalCalibration ? [field('Interval correction', `Outward ${p.rulEvidence.intervalCalibration.radius.toFixed(2)} pseudo-h / ${p.rulEvidence.intervalCalibration.scope}; tails rounded outward`)] : []), field('Out-of-training features', p.rulEvidence.outsideTraining.join(', ') || 'None')] : []), ...provenance]);
  node('recommendation', 'Service recommendation', 'sdt:ServiceActionRecommendation', 'UE', 'decision', 735, 175, execution ? 'Captured pre-service proposal' : 'Advisory', [field('Proposed service', rec.label), field('Estimated TCS', gbp(rec.totalCost)), field('Estimated residual risk', rec.residualRiskScore.toFixed(3)), field('Selection basis', proposal.selectionBasis), field('Risk filter', rec.acceptable ? 'Accepted by dashboard policy' : 'No eligible candidate passed; cost fallback'), ...rec.costs.map((cost) => field(cost.label, gbp(cost.value))), ...proposalProvenance]);
  node('service', rec.label, rec.type, 'UE', 'service', 735, 350, 'Proposed service', [field('Service key', rec.action), field('Class mapping', rec.type === 'sdt:MaintenanceProcess' || rec.type === 'sdt:ServiceProcess' ? 'Mapped to an existing generic class; no new OWL subclass asserted' : 'Existing Chapter 4 class'), field('Cost definition', 'Dashboard estimate; cost fields are not native SDT properties')]);
  node('contract', 'Contract KPI context', 'sdt:Contract', 'UE', 'contract', 735, 0, snapshot.contract ? 'Chapter 5 reference' : 'No contract record', [field('Scope', 'Dataset reference; not a live reassessment of simulated downtime')]);
  if (snapshot.contract) {
    node('kpi', 'Availability KPI', 'sdt:ContractKPI', 'UE', 'contract', 490, 350, snapshot.contract.status, [field('Reference actual', `${(snapshot.contract.actual * 100).toFixed(2)}%`), field('Reference target', `${(snapshot.contract.target * 100).toFixed(2)}%`)]);
    link('contract', 'kpi', 'sdt:hasKPI');
  }
  link('asset', 'blade', 'sdt:hasComponent');
  link('blade', 'sensor', 'sdt:monitoredBy');
  link('asset', 'environment', 'sdt:exposedTo');
  link('observation', 'sensor', 'sosa:madeBySensor');
  link('observation', 'blade', 'sosa:hasFeatureOfInterest');
  link('condition', 'blade', 'sdt:affects');
  link('blade', 'rul', 'sdt:hasRUL');
  link('asset', 'state', 'sdt:currentState');
  if (execution && snapshot.id !== execution.before.id) {
    const before = execution.before.reading;
    node('proposal-condition', 'Captured blade condition', 'sdt:ConditionEvent', 'DTE', 'evidence', 980, 175, 'Original proposal input', [field('Crack length', `${before.crackMm ?? 'n/a'} mm`), ...proposalProvenance]);
    node('proposal-rul', 'Captured RUL estimate', 'sdt:RULEstimate', 'DTE', 'prediction', 980, 350, 'Original proposal input', [field('P10 / P50 / P90', `${before.rulP10} / ${before.rulP50} / ${before.rulP90} h`), ...proposalProvenance]);
    link('recommendation', 'proposal-rul', 'prov:wasDerivedFrom');
    link('recommendation', 'proposal-condition', 'prov:wasDerivedFrom');
  } else {
    link('recommendation', 'rul', 'prov:wasDerivedFrom');
    link('recommendation', 'condition', 'prov:wasDerivedFrom');
  }
  link('recommendation', 'service', 'sdt:recommendsAction');
  // The dataset has a KPI context, but no identified asset-contract assertion.
  if (execution) {
    node('execution', execution.label, 'sdt:ActionExecution', 'UE', 'service', 735, 525, execution.status === 'completed' ? 'Simulated completion' : execution.status === 'interrupted' ? 'Interrupted simulation' : 'Simulated downtime', [field('Execution ID', execution.id), field('Planned downtime', `${execution.downtimeH} h`), field('Recorded downtime', `${execution.progress?.elapsedH ?? 0} h`), field('End reason', execution.endReason ?? 'n/a'), field('Authorisation', 'Not recorded; automatic demonstration policy'), field('Outcome assessment', 'Pending measured evidence')]);
    link('execution', 'recommendation', 'sdt:executesRecommendation');
    if (execution.after) {
      const after = execution.after.reading;
      const before = execution.before.reading;
      node('post-observation', 'Post-service readings', 'sdt:PostActionObservation', 'DCDCE', 'evidence', 490, 525, 'Simulated result', [field('Crack before / after', `${before.crackMm ?? 'n/a'} / ${after.crackMm ?? 'n/a'} mm`), field('RUL P10 before / after', `${before.rulP10} / ${after.rulP10} h`), field('Z vibration before / after', `${before.vibrationRms.toFixed(3)} / ${after.vibrationRms.toFixed(3)} g`), field('Service state after', execution.after.serviceState), field('Evaluation', 'Measured intervention outcome and policy feedback not recorded')]);
      link('execution', 'post-observation', 'sdt:hasPostActionObservation');
      link('post-observation', 'blade', 'sosa:hasFeatureOfInterest');
    }
  }
  return { nodes, relations };
}

export function updateExecutionLog(log: OntologyExecution[], execution: OntologyExecution): OntologyExecution[] {
  const existing = log.find((entry) => entry.id === execution.id);
  if (existing?.status === execution.status && existing.after?.id === execution.after?.id &&
      existing.during?.[existing.during.length - 1]?.id === execution.during?.[execution.during.length - 1]?.id &&
      existing.progress?.elapsedH === execution.progress?.elapsedH) return log;
  const next = structuredClone({ ...execution, before: existing?.before ?? execution.before });
  return [next, ...log.filter((entry) => entry.id !== execution.id)].slice(0, 30);
}
