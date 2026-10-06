// Equal-requirement microbenchmark, separate from the production application profile.
import {DataFactory,Store,Parser,Writer} from 'n3';
import type {SemanticInput} from './semantic.ts';
import {decide} from './model.ts';
const ns='urn:cmapss:comparison:';
const {namedNode:n,literal:l}=DataFactory;
export type Fixture={asset:string;expectedVersion:string;estimate:{id:string;asset:string;unit?:string;model:string;source?:string};recommendation:{estimate?:string;version:string;action:string}};
export const requirements=[
 ['R1','Estimate explicitly uses cycle units'],['R2','Estimate asset matches the snapshot asset'],
 ['R3','Recommendation version matches the expected contract version'],['R4','Estimate retains its source hash'],
 ['R5','Recommendation links to the snapshot estimate']
];
export function conventionalCheck(f:Fixture){const errors:string[]=[];
 if(f.estimate.unit!=='cycles')errors.push('R1');
 if(f.estimate.asset!==f.asset)errors.push('R2');
 if(f.recommendation.version!==f.expectedVersion)errors.push('R3');
 if(!f.estimate.source||!/^[a-f0-9]{64}$/.test(f.estimate.source))errors.push('R4');
 if(f.recommendation.estimate!==f.estimate.id)errors.push('R5');return errors;
}
// A join query, not a validator: mismatched values may remain queryable on both paths.
export function conventionalQuery(f:Fixture){if(f.recommendation.estimate!==f.estimate.id||!f.estimate.source)return [];
 return [{asset:f.asset,estimate:f.estimate.id,estimateAsset:f.estimate.asset,model:f.estimate.model,source:f.estimate.source,version:f.recommendation.version,action:f.recommendation.action}];}
export const comparisonShapes=`@prefix c: <${ns}> . @prefix sh: <http://www.w3.org/ns/shacl#> .
c:Audit a sh:NodeShape; sh:targetNode c:snapshot;
 sh:property c:R1,c:R2,c:R3,c:R4,c:R5 .
c:R1 sh:path (c:estimate c:unit); sh:minCount 1; sh:maxCount 1; sh:hasValue "cycles" .
c:R2 sh:path (c:estimate c:asset); sh:minCount 1; sh:maxCount 1; sh:equals c:asset .
c:R3 sh:path (c:recommendation c:version); sh:minCount 1; sh:maxCount 1; sh:equals c:expectedVersion .
c:R4 sh:path (c:estimate c:source); sh:minCount 1; sh:maxCount 1; sh:pattern "^[a-f0-9]{64}$" .
c:R5 sh:path (c:recommendation c:estimate); sh:minCount 1; sh:maxCount 1; sh:equals c:estimate .`;
export const comparisonQuery=`PREFIX c: <${ns}>
 SELECT ?asset ?estimate ?estimateAsset ?model ?source ?version ?action WHERE {
 c:snapshot c:asset ?asset; c:estimate ?estimate; c:recommendation ?r .
 ?r c:estimate ?estimate; c:version ?version; c:action ?action .
 ?estimate c:asset ?estimateAsset; c:model ?model; c:source ?source . }`;
export function comparisonDataset(f:Fixture){const store=new Store();
 const ref=(s:string,p:string,o:string)=>store.addQuad(n(s),n(ns+p),n(o));
 const val=(s:string,p:string,v:string|undefined)=>{if(v!==undefined)store.addQuad(n(s),n(ns+p),l(v));};
 ref(ns+'snapshot','asset',f.asset);ref(ns+'snapshot','estimate',f.estimate.id);ref(ns+'snapshot','recommendation',ns+'recommendation');
 val(ns+'snapshot','expectedVersion',f.expectedVersion);ref(f.estimate.id,'asset',f.estimate.asset);
 val(f.estimate.id,'unit',f.estimate.unit);val(f.estimate.id,'model',f.estimate.model);val(f.estimate.id,'source',f.estimate.source);
 if(f.recommendation.estimate)ref(ns+'recommendation','estimate',f.recommendation.estimate);
 val(ns+'recommendation','version',f.recommendation.version);val(ns+'recommendation','action',f.recommendation.action);return store;}
export function comparisonFixtures(input:SemanticInput){
 const asset=`urn:cmapss:${input.dataset??'FD001'}:engine:${input.engine}`;
 const good:Fixture={asset,expectedVersion:input.contract?.version??'1',estimate:{id:asset+`:cycle:${input.point.cycle}:estimate`,asset,unit:'cycles',model:input.provenance.model,source:input.provenance.files[`test_${input.dataset??'FD001'}.txt`]},recommendation:{version:input.contract?.version??'1',action:decide(input.point,input.scenario).chosen.name}};
 good.recommendation.estimate=good.estimate.id;
 const cases:{name:string;expected:string[];mutate:(f:Fixture)=>void}[]=[
  {name:'Valid evidence',expected:[],mutate:()=>{}},
  {name:'Missing unit',expected:['R1'],mutate:f=>{delete f.estimate.unit;}},
  {name:'Wrong unit',expected:['R1'],mutate:f=>{f.estimate.unit='hours';}},
  {name:'Wrong asset link',expected:['R2'],mutate:f=>{f.estimate.asset='urn:cmapss:other-asset';}},
  {name:'Outdated contract version',expected:['R3'],mutate:f=>{f.recommendation.version='outdated';}},
  {name:'Missing source',expected:['R4'],mutate:f=>{delete f.estimate.source;}},
  {name:'Missing estimate link',expected:['R5'],mutate:f=>{delete f.recommendation.estimate;}}
 ];
 return cases.map(c=>{const fixture=JSON.parse(JSON.stringify(good)) as Fixture;c.mutate(fixture);return {name:c.name,expected:c.expected,fixture};});
}
async function serialise(store:Store){const w=new Writer();w.addQuads([...store]);return new Promise<string>((resolve,reject)=>w.end((e,t)=>e?reject(e):resolve(t)));}
const canonical=(rows:Record<string,string>[])=>JSON.stringify(rows.map(r=>Object.fromEntries(Object.entries(r).sort())).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
export async function runEvidenceComparison(input:SemanticInput){
 const [{QueryEngine},{default:Validator}]=await Promise.all([import('@comunica/query-sparql-rdfjs'),import('rdf-validate-shacl')]);
 const shapeStore=new Store(new Parser().parse(comparisonShapes)),engine=new QueryEngine();const results=[];
 for(const item of comparisonFixtures(input)){
  const store=comparisonDataset(item.fixture),report=await new Validator(shapeStore).validate(store);
  const rdfErrors=[...new Set(report.results.map(r=>r.sourceShape.value.replace(ns,'')))].sort();
  const jsErrors=conventionalCheck(item.fixture),jsRows=conventionalQuery(item.fixture),rdfRows:Record<string,string>[]=[];
  for await(const row of await engine.queryBindings(comparisonQuery,{sources:[store]})){const r:Record<string,string>={};for(const [key,v]of row)r[key.value]=v.value;rdfRows.push(r);}
  results.push({...item,jsErrors,rdfErrors,jsRows,rdfRows,conforms:report.conforms,
   matchesExpected:JSON.stringify(jsErrors)===JSON.stringify(item.expected)&&JSON.stringify(rdfErrors)===JSON.stringify(item.expected),
   queryParity:canonical(jsRows)===canonical(rdfRows),datasetTTL:await serialise(store),reportTTL:await serialise(new Store([...report.dataset]))});
 }
 return {version:'1.0',cycle:input.point.cycle,engine:input.engine,requirements,comparisonShapes,comparisonQuery,results,
  scope:'Bounded parity experiment: one provenance query, five requirements, seven authored fixtures from one FD001 snapshot. JSON checks and RDF/SHACL receive equivalent values and defects. Separate comparison profile, not the full application ontology or production approval gate.',
  interpretation:'Equal outcomes show both implementations can meet these bounded requirements. No ontology superiority, runtime advantage, broad interoperability or maintenance-cost claim is established.',
  contractAuthority:'Expected contract version is supplied as scenario metadata, not retrieved from an authoritative registry.',provenance:input.provenance};
}
