import { buildSemanticGraph, evidenceSource, type OntologySnapshot } from './model.ts';
import { rulBandLabel, rulDescription, rulModel } from '../model/xgboost.ts';

export type MappingRow = {
  id: string;
  nodeId: string;
  layer: string;
  responsibility: string;
  entity: string;
  label: string;
  value: string;
  source: string;
  evidence: string;
  unit: string;
  uri: string;
};
export type DataRecord = {
  id: string;
  sequence: number;
  recordedAt: string;
  snapshot: OntologySnapshot;
  rows: MappingRow[];
  changes: string[];
  fingerprint: string;
};
export const recordLimit = 120;

export function snapshotFingerprint(snapshot: OntologySnapshot) {
  // Capture timestamps alone are not a new observation; GPS-only changes are.
  return JSON.stringify([snapshot.id, snapshot.reading, snapshot.position, snapshot.serviceState, snapshot.candidates, snapshot.recommendation, snapshot.contract]);
}

export function mappingRows(snapshot: OntologySnapshot): MappingRow[] {
  const p = snapshot.reading;
  const graph = buildSemanticGraph(snapshot);
  const source = evidenceSource(p);
  const reference = p.acquisitionIndex == null ? 'No acquisition-window identifier supplied' : `Acquisition window ${p.acquisitionIndex}`;
  const featureSource = p.rulEvidence?.featureSource ?? 'Legacy / feature provenance unavailable';
  const rows: Omit<MappingRow, 'uri'>[] = [
    { id: 'gps', nodeId: 'asset', layer: 'OME', responsibility: 'Asset / site context', entity: 'sdt:Asset', label: 'Site position', value: `${snapshot.position.lat.toFixed(5)}, ${snapshot.position.lon.toFixed(5)}`, unit: 'deg', source: snapshot.position.source, evidence: snapshot.position.source === 'Device GPS' ? 'Browser device location; not a turbine-mounted GPS feed' : 'Scenario/site coordinates; not a measured moving-turbine track' },
    { id: 'registry', nodeId: 'blade', layer: 'DTE', responsibility: 'Operation & Management / asset registry', entity: 'sdt:Asset / sdt:Component', label: 'Asset registry', value: `${snapshot.asset} / ${snapshot.component}`, unit: 'identifier', source: 'Dashboard asset/component configuration', evidence: 'Stable asset identity links observations and service evidence; not a new physical asset registration' },
    { id: 'wind', nodeId: 'environment', layer: 'DCDCE', responsibility: 'Data Collection / environment context', entity: 'sdt:OperatingEnvironment', label: 'Wind context', value: `${p.windSpeed.toFixed(2)} m/s / ${p.windDirection.toFixed(1)} deg`, unit: 'm/s; deg', source, evidence: `${reference}; anemometer / wind vane are rig references, not connected devices. Direction is context, not an RUL feature.` },
    { id: 'vibration', nodeId: 'observation', layer: 'DCDCE', responsibility: 'Data Collection / observation', entity: 'sosa:Observation', label: 'Blade vibration', value: `${p.vibrationRms.toFixed(4)} g / ${p.kurtosis.toFixed(3)} kurtosis`, unit: 'g; dimensionless', source: `${source} / ${featureSource}`, evidence: `${reference}; logical MC3419 channel. No live accelerometer feed; archived waveforms are separate references.` },
    { id: 'crack', nodeId: 'condition', layer: 'DTE', responsibility: 'Application & Service / condition', entity: 'sdt:ConditionEvent', label: 'Blade condition', value: `${p.crackMm == null ? 'Unavailable' : `${p.crackMm.toFixed(3)} mm`} / ${p.crackState ?? 'Unclassified'}`, unit: 'mm', source, evidence: 'Replay or assumed crack growth / simulated repair; not independent signal-to-crack detection' },
    { id: 'rul', nodeId: 'rul', layer: 'DTE', responsibility: 'Application & Service / prognosis', entity: 'sdt:RULEstimate (projection) / wt:PseudoRULEstimate (RDF)', label: 'RUL estimate', value: `${p.rulP10} / ${p.rulP50} / ${p.rulP90} pseudo-h`, unit: 'pseudo-h', source: rulDescription(p), evidence: `${rulBandLabel(p)}; ${featureSource}; model ${p.modelVersion ?? 'not recorded'}; synthetic target, not field lifetime` },
    { id: 'state', nodeId: 'state', layer: 'DTE', responsibility: 'Application & Service / service policy', entity: 'sdt:ServiceState', label: 'Service state', value: snapshot.serviceState, unit: 'category', source: p.serviceMode === 'in-downtime' ? 'src/App.tsx / makeDowntimePoint (simulated service hold)' : 'Recorded service state / src/model/operating.ts / conditionState', evidence: 'Rule-based or recorded service status; downtime explicitly sets MaintenanceDue. Not an OWL-inferred state.' },
    { id: 'recommendation', nodeId: 'recommendation', layer: 'DTE → UE', responsibility: 'Application & Service → advisory user view', entity: 'sdt:ServiceActionRecommendation', label: 'Service / TCS', value: `${snapshot.recommendation.label} / GBP ${snapshot.recommendation.totalCost.toFixed(2)}`, unit: 'GBP (assumed)', source: 'src/model/service.ts / serviceDecisionByTcs', evidence: snapshot.selectionBasis },
    { id: 'service', nodeId: 'asset', layer: 'DCDCE → UE', responsibility: 'Device Control mapping / simulated control status', entity: 'Snapshot control metadata (not an OWL assertion)', label: 'Execution context', value: p.serviceMode ? `${p.serviceMode} / ${p.serviceAction ?? 'not recorded'} / ${p.elapsedDowntimeH == null ? 'elapsed time not supplied' : `${p.elapsedDowntimeH} h elapsed`}` : 'Advisory / no active downtime in this reading', unit: 'modeled h', source: `${source} / src/App.tsx service simulator`, evidence: 'Context attached to this asset snapshot, not a fabricated execution individual. Actual simulated event records are in Decision Trace; no physical actuation or measured outcome.' },
    { id: 'contract', nodeId: snapshot.contract ? 'kpi' : 'contract', layer: 'UE', responsibility: 'Contract KPI / reference reporting', entity: 'sdt:ContractKPI', label: 'Availability reference', value: snapshot.contract ? `${(snapshot.contract.actual * 100).toFixed(2)}% / target ${(snapshot.contract.target * 100).toFixed(2)}%` : 'Not supplied', unit: '%', source: 'src/data/dashboardData.json / service.kpiSettlement', evidence: 'Static Chapter 5 dataset reference; not recomputed from current simulated downtime' },
    { id: 'provenance', nodeId: 'observation', layer: 'DTE / cross-system', responsibility: 'Resource Access & Interchange / evidence access', entity: 'PROV-O links / snapshot metadata', label: 'Evidence provenance', value: `${p.source ?? 'Fallback simulation'} / ${featureSource}`, unit: 'source metadata', source: 'Shared dashboard snapshot / in-memory record buffer', evidence: `${reference}; record export retains source, model and timestamps. Cross-system responsibility, not a separate ISO layer or full OWL validation.` }
  ];
  return rows.map(row => ({ ...row, uri: graph.nodes.find(node => node.id === row.nodeId)?.uri ?? '' }));
}

export function changedMappingRows(current: MappingRow[], previous?: MappingRow[]) {
  return current.filter(row => {
    const before = previous?.find(item => item.id === row.id);
    return !before || [row.value, row.source, row.evidence, row.entity].some((value, i) => value !== [before.value, before.source, before.evidence, before.entity][i]);
  }).map(row => row.id);
}

export function appendDataRecord(records: DataRecord[], snapshot: OntologySnapshot, recordedAt: string): DataRecord[] {
  const fingerprint = snapshotFingerprint(snapshot);
  if (records[0]?.fingerprint === fingerprint) return records;
  const rows = mappingRows(snapshot);
  const sequence = (records[0]?.sequence ?? 0) + 1;
  return [{ id: `${snapshot.id}:record-${sequence}`, sequence, recordedAt, snapshot: structuredClone(snapshot), rows, changes: changedMappingRows(rows, records[0]?.rows), fingerprint }, ...records].slice(0, recordLimit);
}

export function recordExport(records: DataRecord[], sessionId: string, ontologyHash: string) {
  const usedActiveModel = records.some(record => record.snapshot.reading.modelVersion === rulModel.version && record.snapshot.reading.rulEvidence?.modelVersion === rulModel.version && record.snapshot.reading.rulEvidence.featureSource !== 'manual-override');
  return {
    format: 'wt-data-lineage-1.0', sessionId, retainedRecords: records.length, capacity: recordLimit,
    scope: 'Browser memory capture of dashboard updates; not raw sensor logging, measured maintenance, full RDF history or OWL inference. Older records beyond capacity are discarded.',
    timeBasis: 'recordedAt is browser wall-clock capture time; reading.t may be a simulated tick; modeled hours are not UI seconds.',
    ontologySHA256: ontologyHash,
    ...(usedActiveModel ? { activeModelReference: { version: rulModel.version, hashes: rulModel.modelHashes, trainingFeaturesSHA256: rulModel.sourceHashes['features.csv'], scope: 'Reference only for records carrying this model version and not manual overrides' } } : {}),
    records: records.map(({ fingerprint: _fingerprint, ...record }) => record)
  };
}
