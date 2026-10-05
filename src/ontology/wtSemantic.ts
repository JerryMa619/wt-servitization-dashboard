import { DataFactory, Parser, Store, Writer } from 'n3';
import type { Quad } from '@rdfjs/types';
import schema from '../data/ontologySchema.json' with { type: 'json' };
import { rulModel } from '../model/xgboost.ts';
import type { OntologySnapshot } from './model.ts';

export const wtNamespace = 'https://w3id.org/sdt-wt/demo#';
const prefixes = { wt: wtNamespace, sdt: 'http://purl.org/sdt/', prov: 'http://www.w3.org/ns/prov#', rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#', xsd: 'http://www.w3.org/2001/XMLSchema#' };
const { namedNode, literal } = DataFactory;
const iri = (value: string) => {
  const [prefix, local] = value.split(':');
  return namedNode(prefix in prefixes ? prefixes[prefix as keyof typeof prefixes] + local : value);
};
export type WtDefect = 'none' | 'missing-unit' | 'missing-evidence';
export const semanticQuestions = [
  { id: 'evidence', label: 'Why this service?' },
  { id: 'candidates', label: 'Which services qualify?' },
  { id: 'features', label: 'Which features support RUL?' }
] as const;

export function createWtDataset(snapshot: OntologySnapshot, defect: WtDefect = 'none') {
  const store = new Store();
  const base = `urn:wt:${encodeURIComponent(snapshot.asset)}:${encodeURIComponent(snapshot.id)}`;
  const root = 'urn:wt:active-snapshot', asset = `${base}:asset`, estimate = `${base}:estimate`, rec = `${base}:recommendation`, observation = `${base}:features`;
  const link = (s: string, p: string, o: string) => store.addQuad(iri(s), iri(p), iri(o));
  const value = (s: string, p: string, v: string | number | boolean, type = 'xsd:string') => {
    if (typeof v === 'number' && !Number.isFinite(v)) throw new Error('Non-finite WT evidence value');
    store.addQuad(iri(s), iri(p), literal(type === 'xsd:decimal' ? Number(v).toFixed(12) : String(v), iri(type)));
  };
  const type = (s: string, cls: string) => link(s, 'rdf:type', cls);
  type(root, 'wt:Snapshot'); link(root, 'wt:asset', asset); link(root, 'wt:estimate', estimate); link(root, 'wt:recommendation', rec);
  value(root, 'wt:capturedAt', snapshot.capturedAt, 'xsd:dateTime'); value(root, 'wt:sourceOntologySHA256', schema.sha256);
  value(root, 'wt:scope', 'Simulation/reference evidence; no hardware, physical lifetime, full SDT validation or OWL reasoning');
  type(asset, 'sdt:Asset'); value(asset, 'wt:assetName', snapshot.asset); value(asset, 'wt:componentName', snapshot.component);
  value(asset, 'wt:serviceState', snapshot.serviceState); value(asset, 'wt:crackMm', snapshot.reading.crackMm ?? 0, 'xsd:decimal');
  type(observation, 'wt:FeatureWindow'); value(observation, 'wt:source', snapshot.reading.source ?? 'legacy');
  value(observation, 'wt:featureSource', snapshot.reading.rulEvidence?.featureSource ?? 'legacy');
  link(observation, 'wt:forAsset', asset);
  const vector = snapshot.reading.rulFeatureVector;
  if (vector) {
    if (vector.length !== rulModel.featureNames.length) throw new Error('WT feature count does not match the model');
    vector.forEach((v, i) => { const node = `${observation}:${i}`; type(node, 'wt:Feature'); link(observation, 'wt:feature', node); value(node, 'wt:featureName', rulModel.featureNames[i]); value(node, 'wt:featureValue', v, 'xsd:decimal'); });
  }
  type(estimate, 'wt:PseudoRULEstimate'); link(estimate, 'wt:unit', 'wt:PseudoHour'); link(estimate, 'prov:wasDerivedFrom', observation);
  value(estimate, 'wt:lowerBound', snapshot.reading.rulP10, 'xsd:decimal'); value(estimate, 'wt:pointEstimate', snapshot.reading.rulP50, 'xsd:decimal'); value(estimate, 'wt:upperBound', snapshot.reading.rulP90, 'xsd:decimal');
  value(estimate, 'wt:modelVersion', snapshot.reading.modelVersion ?? 'legacy');
  value(estimate, 'wt:boundMeaning', snapshot.reading.modelVersion === rulModel.version && snapshot.reading.rulEvidence?.featureSource !== 'manual-override' ? 'Adjusted percentile-based envelope; not exact conditional P10/P90' : 'Historical/manual bounds; not active-model calibrated uncertainty');
  if (snapshot.reading.modelVersion === rulModel.version && snapshot.reading.rulEvidence?.featureSource !== 'manual-override') {
    const model = `urn:sha256:${rulModel.modelHashes.p50}`;
    type(model, 'wt:ModelArtifact'); link(estimate, 'wt:generatedWith', model);
    value(model, 'wt:p50SHA256', rulModel.modelHashes.p50); value(model, 'wt:trainingFeaturesSHA256', rulModel.sourceHashes['features.csv']);
  }
  type(rec, 'sdt:ServiceActionRecommendation'); value(rec, 'sdt:recommendationStatus', 'proposed');
  link(rec, 'wt:forAsset', asset); link(rec, 'wt:basedOnEstimate', estimate); value(rec, 'wt:selectionBasis', snapshot.selectionBasis);
  snapshot.candidates.forEach((candidate, i) => {
    const node = `${rec}:candidate:${i}`; type(node, 'wt:Candidate'); link(rec, 'wt:candidate', node);
    value(node, 'wt:action', candidate.label); value(node, 'wt:actionKey', candidate.action); value(node, 'wt:eligible', candidate.acceptable, 'xsd:boolean');
    value(node, 'wt:totalCost', candidate.totalCost, 'xsd:decimal'); value(node, 'wt:riskIndex', candidate.residualRiskScore, 'xsd:decimal'); link(node, 'wt:costUnit', 'wt:GBP');
    if (candidate.action === snapshot.recommendation.action) link(rec, 'wt:selectedCandidate', node);
  });
  if (defect === 'missing-unit') store.removeQuads(store.getQuads(iri(estimate), iri('wt:unit'), null, null));
  if (defect === 'missing-evidence') store.removeQuads(store.getQuads(iri(rec), iri('wt:basedOnEstimate'), null, null));
  return store;
}

async function ttl(quads: Iterable<Quad>) {
  const writer = new Writer({ prefixes }); writer.addQuads([...quads]);
  return new Promise<string>((resolve, reject) => writer.end((error, text) => error ? reject(error) : resolve(text)));
}
export async function sha256(text: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))).map(v => v.toString(16).padStart(2, '0')).join('');
}
export async function executeWtSemantic(snapshot: OntologySnapshot, shapesText: string, query: string, defect: WtDefect = 'none') {
  const [{ QueryEngine }, { default: SHACLValidator }] = await Promise.all([import('@comunica/query-sparql-rdfjs'), import('rdf-validate-shacl')]);
  const store = createWtDataset(snapshot, defect);
  const report = await new SHACLValidator(new Store(new Parser().parse(shapesText))).validate(store);
  const rows: Record<string, string>[] = [];
  for await (const binding of await new QueryEngine().queryBindings(query, { sources: [store] })) {
    const row: Record<string, string> = {}; for (const [variable, term] of binding) row[variable.value] = term.value; rows.push(row);
  }
  const datasetTTL = await ttl(store);
  return { conforms: report.conforms, triples: store.size, rows, datasetTTL, reportTTL: await ttl(report.dataset), query, defect,
    violations: report.results.map(r => ({ focus: r.focusNode?.value ?? '', path: r.path?.value ?? '', message: r.message.map(m => m.value).join('; ') })),
    shapesSHA256: await sha256(shapesText), datasetSHA256: await sha256(datasetTTL), snapshotSHA256: await sha256(JSON.stringify(snapshot)),
    scope: 'WT application profile 1.0 / SHACL Core; structural checks, not field accuracy, cost optimality, original SDT conformance or OWL inference' };
}
