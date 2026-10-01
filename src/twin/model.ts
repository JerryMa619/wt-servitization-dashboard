import type { OntologyExecution, OntologySnapshot } from '../ontology/model';

export type WorkflowStage = 'monitor' | 'decision' | 'downtime' | 'result';
export type ReplayFrame = { id: string; label: string; stage: WorkflowStage; snapshot: OntologySnapshot; elapsedH: number };
export type ModuleId = 'collection' | 'control' | 'registry' | 'condition' | 'rul' | 'state' | 'tcs' | 'access' | 'authorisation' | 'recommendation' | 'execution' | 'kpi';
export type ArchitectureModule = { id: ModuleId; title: string; entity: string; subEntity: string; extension: boolean; x: number; y: number; width: number; height: number; ontologyNode?: string };

export const architectureModules: ArchitectureModule[] = [
  { id: 'collection', title: 'Data collection', entity: 'dcdce', subEntity: 'Data Collection', extension: false, x: 10, y: 154, width: 168, height: 106, ontologyNode: 'observation' },
  { id: 'control', title: 'Device control', entity: 'dcdce', subEntity: 'Device Control', extension: false, x: 10, y: 302, width: 168, height: 106, ontologyNode: 'execution' },
  { id: 'registry', title: 'Asset model & synchronisation', entity: 'dte', subEntity: 'Operation & Management', extension: false, x: 12, y: 48, width: 366, height: 78, ontologyNode: 'asset' },
  { id: 'condition', title: 'Blade condition', entity: 'dte', subEntity: 'Application & Service', extension: false, x: 12, y: 154, width: 174, height: 106, ontologyNode: 'condition' },
  { id: 'rul', title: 'RUL prediction', entity: 'dte', subEntity: 'Application & Service', extension: false, x: 204, y: 154, width: 174, height: 106, ontologyNode: 'rul' },
  { id: 'state', title: 'Service State', entity: 'dte', subEntity: 'Application & Service', extension: true, x: 12, y: 302, width: 174, height: 106, ontologyNode: 'state' },
  { id: 'tcs', title: 'TCS & risk selection', entity: 'dte', subEntity: 'Application & Service', extension: true, x: 204, y: 302, width: 174, height: 106, ontologyNode: 'recommendation' },
  { id: 'access', title: 'Evidence access & interchange', entity: 'dte', subEntity: 'Resource Access & Interchange', extension: false, x: 12, y: 440, width: 366, height: 78, ontologyNode: 'rul' },
  { id: 'authorisation', title: 'Authorisation', entity: 'ue', subEntity: 'Service governance', extension: true, x: 12, y: 48, width: 174, height: 78 },
  { id: 'recommendation', title: 'Service recommendation', entity: 'ue', subEntity: 'Decision support', extension: true, x: 12, y: 154, width: 174, height: 106, ontologyNode: 'recommendation' },
  { id: 'execution', title: 'Service execution', entity: 'ue', subEntity: 'Service workflow', extension: true, x: 12, y: 302, width: 174, height: 106, ontologyNode: 'execution' },
  { id: 'kpi', title: 'Contract KPI', entity: 'ue', subEntity: 'Contract reporting', extension: true, x: 12, y: 440, width: 174, height: 78, ontologyNode: 'kpi' }
];

export function workflowStage(snapshot: OntologySnapshot): WorkflowStage {
  if (snapshot.reading.serviceMode === 'in-downtime') return 'downtime';
  if (snapshot.reading.serviceMode === 'post-service') return 'result';
  return snapshot.serviceState === 'Nominal' ? 'monitor' : 'decision';
}

export function replayFrames(execution: OntologyExecution): ReplayFrame[] {
  const frames: ReplayFrame[] = [
    { id: `${execution.id}-evidence`, label: 'Pre-service evidence', stage: 'monitor', snapshot: execution.before, elapsedH: 0 },
    { id: `${execution.id}-decision`, label: 'Captured recommendation', stage: 'decision', snapshot: execution.before, elapsedH: 0 }
  ];
  for (const [index, snapshot] of (execution.during ?? []).entries()) {
    frames.push({ id: snapshot.id, label: `Recorded downtime ${index + 1}`, stage: 'downtime', snapshot, elapsedH: snapshot.reading.elapsedDowntimeH ?? 0 });
  }
  if (execution.after) frames.push({ id: execution.after.id, label: 'Post-service result', stage: 'result', snapshot: execution.after, elapsedH: execution.downtimeH });
  return frames;
}

export function activeModules(stage: WorkflowStage): ModuleId[] {
  return [...new Set(activeConnections(stage).flatMap(([source, target]) => [source, target]))];
}

export function activeConnections(stage: WorkflowStage): [ModuleId, ModuleId][] {
  const acquisition: [ModuleId, ModuleId][] = [['collection', 'registry'], ['registry', 'access']];
  // Acquisition remains active while a proposal or simulated intervention is processed.
  if (stage === 'downtime') return [...acquisition, ['recommendation', 'execution'], ['execution', 'control']];
  const monitoring: [ModuleId, ModuleId][] = [...acquisition, ['collection', 'condition'], ['condition', 'rul']];
  if (stage === 'result') return [...monitoring, ['execution', 'collection'], ['condition', 'state']];
  if (stage === 'decision') return [...monitoring, ['condition', 'state'], ['rul', 'tcs'], ['state', 'tcs'], ['tcs', 'recommendation']];
  return monitoring;
}

export function moduleValue(id: ModuleId, snapshot: OntologySnapshot, execution: OntologyExecution | null, stage: WorkflowStage): string {
  const reading = snapshot.reading;
  switch (id) {
    case 'collection': return `${reading.vibrationRms.toFixed(3)} g / ${reading.windSpeed.toFixed(1)} m/s`;
    case 'control': return stage === 'downtime' ? 'Simulated hold / rotor target 0' : 'No physical actuator connected';
    case 'registry': return `${snapshot.asset} / ${snapshot.component}`;
    case 'condition': return `${reading.crackState ?? 'C?'} / ${reading.crackMm?.toFixed(1) ?? 'n/a'} mm`;
    case 'rul': return `P10 ${reading.rulP10} / P50 ${reading.rulP50} h`;
    case 'state': return snapshot.serviceState;
    case 'tcs': return `GBP ${snapshot.recommendation.totalCost.toLocaleString('en-GB')} / risk ${snapshot.recommendation.residualRiskScore.toFixed(2)}`;
    case 'access': return 'SDT projection / session evidence';
    case 'authorisation': return 'Not recorded / auto demo policy';
    case 'recommendation': return snapshot.recommendation.label;
    case 'execution': return stage === 'downtime' ? execution?.label ?? 'Simulated maintenance' : stage === 'result' ? 'Simulation result recorded' : 'No current intervention';
    case 'kpi': return snapshot.contract ? `Reference target ${(snapshot.contract.target * 100).toFixed(1)}%` : 'No contract record';
  }
}

export function stageLabel(stage: WorkflowStage): string {
  return { monitor: 'Monitoring and synchronisation', decision: 'Service decision available', downtime: 'Simulated maintenance downtime', result: 'Post-service observation' }[stage];
}
