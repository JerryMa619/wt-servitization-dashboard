import { DataFactory, Parser, Store, Writer } from 'n3';
import type { Quad } from '@rdfjs/types';
import { decide, state, type Point, type Scenario, type DatasetId } from './model.ts';
import { capacityBudget, matchesPolicy, type ContractTerms } from './contracts.ts';

export const NS = {
  cm: 'https://w3id.org/sdt-cmapss/demo#', sdt: 'http://purl.org/sdt/',
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#', rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  xsd: 'http://www.w3.org/2001/XMLSchema#', prov: 'http://www.w3.org/ns/prov#',
  sosa: 'http://www.w3.org/ns/sosa/'
};
const { namedNode: nn, literal } = DataFactory;
export const iri = (term: string) => {
  const [prefix, local] = term.split(':');
  return nn(prefix in NS ? NS[prefix as keyof typeof NS] + local : term);
};
export type SemanticInput = {
  dataset?: DatasetId; engine: number; point: Point; scenario: Scenario; contract?: ContractTerms;
  provenance: { model: string; baselineSHA256: string; exporterSHA256: string; files: Record<string, string>; ontologySHA256: string; sensorNumbers: number[] };
};
export type Defect = 'none' | 'missing-unit' | 'missing-evidence';
export function createDataset(input: SemanticInput, defect: Defect = 'none') {
  const { engine, point: p, scenario, provenance, contract, dataset = 'FD001' } = input;
  if (!['FD001','FD002','FD003','FD004'].includes(dataset) || !provenance.model.startsWith(dataset.toLowerCase()+'-')) throw new Error('Dataset/model identity mismatch');
  if(contract && !matchesPolicy(contract,scenario)) throw new Error('Named contract does not match the current policy');
  const store = new Store();
  const asset = `urn:cmapss:${dataset}:engine:${engine}`;
  const frame = `${asset}:cycle:${p.cycle}`;
  const variant = `${frame}:scenario:${scenario.consequence}_${scenario.maintenance}_${scenario.leadMultiplier}_${scenario.gate}${contract?`:contract:${contract.id}:v${contract.version}:kpi:${contract.target}_${contract.periodSlots}_${contract.plannedLossSlots}_${contract.unplannedLossSlots}`:''}`;
  const estimate = `${frame}:estimate:${provenance.model}`;
  const window = `${frame}:window`;
  const rec = `${variant}:recommendation`;
  const policy = `${variant}:policy`;
  const model = `urn:cmapss:model:${provenance.model}:${provenance.baselineSHA256}`;
  const link = (s: string, predicate: string, o: string) => store.addQuad(iri(s), iri(predicate), iri(o));
  const value = (s: string, predicate: string, v: string | number | boolean, type = 'xsd:string') => {
    if (typeof v === 'number' && !Number.isFinite(v)) throw new Error('Non-finite RDF value');
    // xsd:decimal does not allow scientific notation.
    const lexical = type === 'xsd:decimal' ? Number(v).toFixed(12) : String(v);
    store.addQuad(iri(s), iri(predicate), literal(lexical, iri(type)));
  };
  const type = (s: string, cls: string) => link(s, 'rdf:type', cls);
  const source = (name: string) => {
    const hash = provenance.files[name];
    if (!hash) throw new Error(`Missing source hash: ${name}`);
    const id = `urn:sha256:${hash}`;
    type(id, 'cm:SourceFile'); value(id, 'cm:fileName', name); value(id, 'cm:sha256', hash);
    return id;
  };
  const root = 'urn:cmapss:active-snapshot';
  type(root, 'cm:Snapshot'); link(root, 'cm:asset', asset); link(root, 'cm:estimate', estimate); link(root, 'cm:recommendation', rec);
  value(root, 'cm:dataset', dataset); value(root, 'cm:sourceOntologySHA256', provenance.ontologySHA256);
  type(asset, 'sdt:Asset'); value(asset, 'cm:engineId', engine, 'xsd:integer');
  link(asset, 'sdt:currentState', `${frame}:state`); type(`${frame}:state`, 'sdt:ServiceState'); value(`${frame}:state`, 'sdt:stateLabel', state(p.low));
  link(asset, 'sdt:governedBy', `${variant}:contract`); type(`${variant}:contract`, 'sdt:Contract'); value(`${variant}:contract`, 'cm:assumption', true, 'xsd:boolean');
  type(window, 'cm:ObservationWindow'); value(window, 'cm:windowStart', Math.max(1,p.cycle-29), 'xsd:integer'); value(window, 'cm:cycle', p.cycle, 'xsd:integer');
  link(window, 'prov:wasDerivedFrom', source(`test_${dataset}.txt`));
  p.settings.forEach((v,i) => value(window, `cm:setting${i+1}`, v, 'xsd:decimal'));
  p.sensors.forEach((v,i) => {
    const channel = provenance.sensorNumbers[i];
    if (!channel) throw new Error('Missing sensor channel identifier');
    const obs = `${frame}:sensor:${channel}`;
    type(obs, 'sosa:Observation'); link(window, 'cm:observation', obs);
    link(obs, 'sosa:hasFeatureOfInterest', asset); link(obs, 'sosa:observedProperty', `cm:Sensor${channel}Value`);
    value(obs, 'sosa:hasSimpleResult', v, 'xsd:decimal'); value(obs, 'cm:cycle', p.cycle, 'xsd:integer');
  });
  type(model, 'cm:ModelArtifact'); value(model, 'cm:modelId', provenance.model); value(model, 'cm:sha256', provenance.baselineSHA256); value(model, 'cm:exporterSHA256', provenance.exporterSHA256);
  link(model, 'prov:wasDerivedFrom', source(`train_${dataset}.txt`));
  type(estimate, 'cm:CycleRULEstimate'); link(estimate, 'cm:unit', 'cm:Cycle');
  value(estimate, 'cm:lowerBound', p.low, 'xsd:decimal'); value(estimate, 'cm:pointEstimate', p.point, 'xsd:decimal'); value(estimate, 'cm:upperBound', p.high, 'xsd:decimal');
  value(estimate, 'cm:cycle', p.cycle, 'xsd:integer'); link(estimate, 'prov:wasDerivedFrom', window); link(estimate, 'cm:generatedWith', model);
  type(policy, 'cm:Policy');
  for (const [name,v] of Object.entries({consequenceRatio:scenario.consequence, maintenanceCost:scenario.maintenance, leadMultiplier:scenario.leadMultiplier, guardrailCycles:scenario.gate})) value(policy, `cm:${name}`, v, 'xsd:decimal');
  if(contract) {
    const id = `${variant}:contract`;
    const kpi = `${id}:capacity-kpi`;
    const budget = capacityBudget(contract);
    type(id, 'cm:ConfiguredContract'); value(id,'cm:contractName',contract.name); value(id,'cm:contractVersion',contract.version);
    value(id,'cm:responsibility',contract.responsibility); link(id,'cm:appliedPolicy',policy);
    for(const [name,v] of Object.entries({consequenceRatio:contract.policy.consequence,maintenanceCost:contract.policy.maintenance,leadMultiplier:contract.policy.leadMultiplier,guardrailCycles:contract.policy.gate})) value(id,`cm:${name}`,v,'xsd:decimal');
    link(id,'sdt:hasKPI',kpi); type(kpi,'sdt:ContractKPI'); type(kpi,'cm:CapacityBudget');
    value(kpi,'cm:assumption',true,'xsd:boolean'); link(kpi,'cm:periodUnit','cm:ScheduledCycleOpportunity');
    value(kpi,'sdt:targetValue',contract.target,'xsd:decimal');
    for(const [name,v] of Object.entries({periodSlots:contract.periodSlots,plannedLossSlots:contract.plannedLossSlots,unplannedLossSlots:contract.unplannedLossSlots,allowedLossSlots:budget.allowedLossSlots,plannedMarginSlots:budget.plannedMarginSlots,plannedCapacityProxy:budget.ifOnePlannedLoss,unplannedCapacityProxy:budget.ifOneUnplannedLoss})) value(kpi,`cm:${name}`,v,'xsd:decimal');
    value(kpi,'cm:plannedFits',budget.plannedFits,'xsd:boolean');
  }
  type(rec, 'sdt:ServiceActionRecommendation'); value(rec, 'sdt:recommendationStatus', 'proposed');
  link(rec, 'cm:forAsset', asset); link(rec, 'cm:basedOnEstimate', estimate); link(rec, 'cm:usesPolicy', policy);
  [estimate,policy,`${variant}:contract`].forEach(entity => link(rec, 'prov:wasDerivedFrom', entity));
  const decision = decide(p,scenario);
  decision.candidates.forEach((c,i) => {
    const candidate = `${variant}:candidate:${i}`;
    type(candidate,'cm:ActionCandidate'); link(rec,'cm:hasCandidate',candidate);
    value(candidate,'cm:actionName',c.name); value(candidate,'cm:eligible',c.allowed,'xsd:boolean');
    for(const [key,v] of Object.entries({directCost:c.direct,riskCost:c.riskCost,totalCost:c.total,reviewCycles:c.lead})) value(candidate,`cm:${key}`,v,'xsd:decimal');
    if(c.name===decision.chosen.name) link(rec,'cm:selectedCandidate',candidate);
  });
  if(defect==='missing-unit') store.removeQuads(store.getQuads(iri(estimate),iri('cm:unit'),null,null));
  if(defect==='missing-evidence') store.removeQuads(store.getQuads(iri(rec),iri('cm:basedOnEstimate'),null,null));
  return { store, estimate, rec, window, root };
}
export async function turtle(store: Iterable<Quad>) {
  const writer = new Writer({ prefixes: NS });
  writer.addQuads([...store]);
  return new Promise<string>((resolve,reject) => writer.end((error,result)=>error?reject(error):resolve(result)));
}
export function compact(value: string) {
  for(const [prefix,namespace] of Object.entries(NS)) if(value.startsWith(namespace)) return prefix+':'+value.slice(namespace.length);
  return value;
}
export async function executeSemantic(input: SemanticInput, shapesText: string, query: string, defect: Defect = 'none') {
  const [{ QueryEngine }, { default: SHACLValidator }] = await Promise.all([
    import('@comunica/query-sparql-rdfjs'), import('rdf-validate-shacl')
  ]);
  const { store } = createDataset(input,defect);
  const shapes = new Store(new Parser().parse(shapesText));
  const report = await new SHACLValidator(shapes).validate(store);
  const bindings = await new QueryEngine().queryBindings(query,{sources:[store]});
  const rows: Record<string,string>[] = [];
  for await (const binding of bindings) {
    const row: Record<string,string> = {};
    for(const [variable,term] of binding) row[variable.value] = term.value;
    rows.push(row);
  }
  return {
    conforms: report.conforms, triples: store.size, rows,
    violations: report.results.map(r=>({focus: r.focusNode?.value ?? '', path: r.path?.value ?? '', message:r.message.map(m=>m.value).join('; '), constraint:r.sourceConstraintComponent?.value ?? ''})),
    datasetTTL: await turtle(store), reportTTL: await turtle(report.dataset), query,
    scope: 'C-MAPSS application profile 0.3.0; SHACL Core only; no OWL inference or full SDT conformance claim',
    defect
  };
}
