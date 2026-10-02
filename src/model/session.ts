import type { OntologyExecution, OntologySnapshot, OntologyReading } from '../ontology/model';
import type { SimulationStats } from './operating';
import { inputBounds } from './operating.ts';
import { actionTypes } from '../ontology/model.ts';
import { rulModel } from './xgboost.ts';

export type SavedSession = { version: 1; asset: string; events: OntologyExecution[]; stats: SimulationStats; latest: OntologyReading; manual: OntologyReading | null; cursor: number; sessionId: string };
export const sessionKey = (asset: string) => `wt-servitization-session-v1:${asset}`;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length < 500;
function validReading(value: unknown): value is OntologyReading {
  if (!object(value) || !text(value.t)) return false;
  if (value.serviceState != null && !['Nominal', 'Watch', 'Degraded', 'MaintenanceDue', 'Critical', 'OutOfContract'].includes(String(value.serviceState))) return false;
  if (['crackGrowthRateMmH', 'elapsedDowntimeH', 'downtimeH', 'availabilityPct', 'acquisitionIndex'].some((key) => value[key] != null && (!finite(value[key]) || (value[key] as number) < 0))) return false;
  if (value.serviceAction != null && (!text(value.serviceAction) || !Object.prototype.hasOwnProperty.call(actionTypes, value.serviceAction))) return false;
  if (value.serviceMode != null && !['in-downtime', 'post-service'].includes(String(value.serviceMode))) return false;
  if (['source', 'modelVersion', 'observedAt', 'receivedAt', 'crackState'].some((key) => value[key] != null && !text(value[key]))) return false;
  if (value.rulFeatureVector != null && (!Array.isArray(value.rulFeatureVector) || value.rulFeatureVector.length !== rulModel.featureNames.length || !value.rulFeatureVector.every(finite))) return false;
  if (value.rulEvidence != null) {
    const evidence = value.rulEvidence;
    if (!object(evidence) || !text(evidence.modelVersion) || evidence.modelVersion !== value.modelVersion || !['chapter5-window', 'reference-assisted', 'imported-window', 'manual-override'].includes(String(evidence.featureSource)) || !Array.isArray(evidence.rawQuantiles) || evidence.rawQuantiles.length !== 3 || !evidence.rawQuantiles.every(finite) || typeof evidence.quantileAdjusted !== 'boolean' || !Array.isArray(evidence.outsideTraining) || evidence.outsideTraining.length > 31 || !evidence.outsideTraining.every((name) => typeof name === 'string' && rulModel.featureNames.includes(name))) return false;
  }
  if (Object.entries(inputBounds).some(([key, bounds]) => value[key] != null && (!finite(value[key]) || (value[key] as number) < bounds.min || (value[key] as number) > bounds.max))) return false;
  return ['windSpeed', 'windDirection', 'rpm', 'power', 'vibrationRms', 'kurtosis', 'modalF1', 'rulP10', 'rulP50', 'rulP90'].every((key) => finite(value[key]) && (value[key] as number) >= 0) && (value.rulP10 as number) <= (value.rulP50 as number) && (value.rulP50 as number) <= (value.rulP90 as number);
}
function validCandidate(value: unknown) {
  return object(value) && text(value.action) && Object.prototype.hasOwnProperty.call(actionTypes, value.action) && text(value.label) && value.type === actionTypes[value.action] && finite(value.totalCost) && value.totalCost >= 0 && finite(value.residualRiskScore) && value.residualRiskScore >= 0 && typeof value.acceptable === 'boolean' && Array.isArray(value.costs) && value.costs.every((cost) => object(cost) && text(cost.label) && finite(cost.value) && cost.value >= 0);
}
function validSnapshot(value: unknown, asset: string): value is OntologySnapshot {
  return object(value) && text(value.id) && text(value.capturedAt) && Number.isFinite(Date.parse(value.capturedAt)) && value.asset === asset && text(value.component) && ['Nominal', 'Watch', 'Degraded', 'MaintenanceDue', 'Critical', 'OutOfContract'].includes(String(value.serviceState)) && validReading(value.reading) && object(value.position) && finite(value.position.lat) && Math.abs(value.position.lat) <= 90 && finite(value.position.lon) && Math.abs(value.position.lon) <= 180 && text(value.position.source) && validCandidate(value.recommendation) && Array.isArray(value.candidates) && value.candidates.every(validCandidate) && text(value.selectionBasis) && (value.contract == null || object(value.contract) && finite(value.contract.actual) && value.contract.actual >= 0 && value.contract.actual <= 1 && finite(value.contract.target) && value.contract.target >= 0 && value.contract.target <= 1 && text(value.contract.status));
}
export function parseSession(raw: string, asset: string): SavedSession {
  if (raw.length > 4_000_000) throw new Error('History file exceeds 4 MB.');
  const value: unknown = JSON.parse(raw);
  if (!object(value) || value.version !== 1 || value.asset !== asset || !Array.isArray(value.events) || value.events.length > 30 || !validReading(value.latest) || value.manual != null && !validReading(value.manual) || !finite(value.cursor) || value.cursor < 0 || !Number.isInteger(value.cursor) || !text(value.sessionId) || !object(value.stats)) throw new Error('Unsupported or invalid dashboard history.');
  if (!['totalDowntimeH', 'observationHours', 'completedServices'].every((key) => finite((value.stats as Record<string, unknown>)[key]) && ((value.stats as Record<string, unknown>)[key] as number) >= 0) || (value.stats.totalDowntimeH as number) > (value.stats.observationHours as number) + 0.00001 || !Number.isInteger(value.stats.completedServices)) throw new Error('Invalid simulation statistics.');
  const ids = new Set<string>();
  for (const event of value.events) {
    if (!object(event)) throw new Error('Invalid service event evidence.');
    const during = event.during ?? [];
    if (!text(event.id) || ids.has(event.id) || !text(event.action) || !text(event.label) || !['in-progress', 'completed', 'interrupted'].includes(String(event.status)) || !finite(event.downtimeH) || event.downtimeH <= 0 || !validSnapshot(event.before, asset) || event.after != null && !validSnapshot(event.after, asset) || event.status === 'completed' && !event.after || !Array.isArray(during) || during.length > 64 || !during.every((frame: unknown) => validSnapshot(frame, asset)) || event.progress != null && (!object(event.progress) || !finite(event.progress.elapsedH) || !finite(event.progress.totalH) || event.progress.elapsedH < 0 || event.progress.elapsedH > event.downtimeH || event.progress.totalH !== event.downtimeH)) throw new Error('Invalid service event evidence.');
    ids.add(event.id);
  }
  return value as unknown as SavedSession;
}

export function interruptExecution(event: OntologyExecution, reason: string): OntologyExecution {
  return event.status === 'in-progress' ? { ...structuredClone(event), status: 'interrupted', endReason: reason } : event;
}
export function closeRestoredSession(session: SavedSession): SavedSession {
  return { ...session, events: session.events.map((event) => interruptExecution(event, 'Browser session ended before maintenance completion')) };
}

export function snapshotBelongsToEvent(snapshot: OntologySnapshot, event: OntologyExecution) {
  return [event.before, ...(event.during ?? []), ...(event.after ? [event.after] : [])].some((frame) => frame.id === snapshot.id && frame.asset === snapshot.asset);
}
