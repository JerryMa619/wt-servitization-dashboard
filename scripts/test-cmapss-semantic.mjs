import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Parser, Store } from 'n3';
import SHACLValidator from 'rdf-validate-shacl';
import { executeSemantic, createDataset, iri, NS } from '../src/cmapss/semantic.ts';
import { tourStops } from '../src/cmapss/tour.ts';
import { defaults, decide } from '../src/cmapss/model.ts';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
const data=JSON.parse(read('src/cmapss/replay.json'));
const schema=JSON.parse(read('src/data/ontologySchema.json'));
const shapes=read('public/cmapss/cmapss-shapes.ttl');
const query=read('public/cmapss/queries/evidence.rq');
const provenance={...data,ontologySHA256:schema.sha256};
const engine=data.engines.find(e=>e.id===34);
const stops=tourStops(engine.points);
assert.deepEqual(stops.map(s=>engine.points[s.index].cycle),[30,94,158,181]);
assert.deepEqual(stops.map(s=>decide(engine.points[s.index],defaults).chosen.name),['Continue','Continue','Continue','Planned Maintenance']);
const results=[];
let last;
for(const stop of stops){
  const input={engine:34,point:engine.points[stop.index],scenario:{...defaults},provenance};
  const result=await executeSemantic(input,shapes,query);
  assert.equal(result.conforms,true);assert.equal(result.rows.length,1);
  assert.equal(Number(result.rows[0].cycle),input.point.cycle);assert.equal(result.rows[0].state,stop.state);
  assert.equal(result.rows[0].action,decide(input.point,input.scenario).chosen.name);
  assert.equal(Number(result.rows[0].point),input.point.point);
  assert.equal(result.rows[0].unit,NS.cm+'Cycle');
  const parsed=new Store(new Parser().parse(result.datasetTTL));assert.equal(parsed.size,result.triples);
  assert.equal(parsed.countQuads(null,iri('rdf:type'),iri('sdt:RULEstimate'),null),0);
  for(const name of ['meanRULhours','p10RULhours','p50RULhours','p90RULhours'])assert.equal(parsed.countQuads(null,iri('sdt:'+name),null,null),0);
  assert.ok(!result.datasetTTL.includes('RUL_FD001.txt'),'Evaluation truth must not enter RDF');
  const rp=new Store(new Parser().parse(result.reportTTL));assert.ok(rp.size>0);
  results.push({case:stop.state,cycle:input.point.cycle,conforms:result.conforms,triples:result.triples,rows:result.rows.length});
  last={input,result};
}
for(const defect of ['missing-unit','missing-evidence']){
  const r=await executeSemantic(last.input,shapes,query,defect);
  assert.equal(r.conforms,false);assert.equal(r.rows.length,0);assert.ok(r.violations.length>0);
  const expected=defect==='missing-unit'?'cm:unit':'cm:basedOnEstimate';
  assert.ok(r.violations.some(v=>v.path===iri(expected).value));
  results.push({case:defect,conforms:r.conforms,violations:r.violations,rows:r.rows.length});
}
const changed={...last.input,scenario:{...defaults,maintenance:2}};
const changedResult=await executeSemantic(changed,shapes,query);
assert.equal(changedResult.rows[0].action,'Derate/Hold');
assert.notEqual(createDataset(changed).rec,createDataset(last.input).rec,'Scenario changes need distinct recommendation IRIs');
assert.equal(createDataset(changed).estimate,createDataset(last.input).estimate,'Cost changes must not change estimate identity');
const candidates=await executeSemantic(last.input,shapes,read('public/cmapss/queries/candidates.rq'));
assert.equal(candidates.rows.length,5);assert.equal(candidates.rows.filter(r=>r.eligible==='false').length,3);
const observations=await executeSemantic(last.input,shapes,read('public/cmapss/queries/observations.rq'));
assert.equal(observations.rows.length,7);
assert.ok(observations.rows.every(r=>r.source==='test_FD001.txt'&&r.hash===data.files['test_FD001.txt']));
// Mutations use the same real SHACL engine, not an implementation-mirroring validator.
async function invalidMutation(name,mutate){
  const d=createDataset(last.input);mutate(d);
  const r=await new SHACLValidator(new Store(new Parser().parse(shapes))).validate(d.store);
  assert.equal(r.conforms,false,name);results.push({case:name,conforms:r.conforms,violations:r.results.length});
}
await invalidMutation('missing source hash',({store})=>store.removeQuads(store.getQuads(null,iri('cm:sha256'),null,null)));
await invalidMutation('empty graph must not vacuously pass',({store})=>store.removeQuads([...store]));
await invalidMutation('missing observation evidence',({store,estimate})=>store.removeQuads(store.getQuads(iri(estimate),iri('prov:wasDerivedFrom'),null,null)));
await invalidMutation('missing policy',({store,rec})=>store.removeQuads(store.getQuads(iri(rec),iri('cm:usesPolicy'),null,null)));
await invalidMutation('inverted RUL bounds',({store,estimate})=>{
  const upper=store.getQuads(iri(estimate),iri('cm:upperBound'),null,null)[0];
  store.removeQuads(store.getQuads(iri(estimate),iri('cm:lowerBound'),null,null));
  store.addQuad(iri(estimate),iri('cm:lowerBound'),upper.object);
});
await invalidMutation('hours assertion prohibited',({store,estimate})=>{
  const point=store.getQuads(iri(estimate),iri('cm:pointEstimate'),null,null)[0];
  store.addQuad(iri(estimate),iri('sdt:meanRULhours'),point.object);
});
for(const e of data.engines){
  const r=await executeSemantic({engine:e.id,point:e.points.at(-1),scenario:defaults,provenance},shapes,query);
  assert.equal(r.conforms,true);assert.equal(Number(r.rows[0].engine),e.id);
}
const sourceHash=path=>createHash('sha256').update(read(path)).digest('hex');
assert.equal(sourceHash('public/ontology/sdt_tbox.ttl'),schema.sha256);
if(process.argv.includes('--record')){
  const dir=new URL('docs/cmapss/semantic-evidence/',root);mkdirSync(dir,{recursive:true});
  writeFileSync(new URL('engine034-cycle181.ttl',dir),last.result.datasetTTL);
  writeFileSync(new URL('engine034-cycle181-shacl-report.ttl',dir),last.result.reportTTL);
  writeFileSync(new URL('verification.json',dir),JSON.stringify({scope:last.result.scope,shapesSHA256:sourceHash('public/cmapss/cmapss-shapes.ttl'),profileSHA256:sourceHash('public/cmapss/cmapss-profile.ttl'),cases:results,otherChecks:['5 action rows / 3 excluded','7 observations with exact source hashes','changed scenario changes advice and recommendation IRI','eight engine endpoints conform','RDF roundtrip and no hours / truth assertions']},null,2)+'\n');
}
console.log(`PASS: four guided milestones, three SPARQL queries, eight engines, SHACL positive/negative cases and scenario identity.`);
