import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {defaults,decide,evidence} from '../src/cmapss/model.ts';
import {comparisonEvidence,contracts,compareContracts} from '../src/cmapss/contracts.ts';
import {createDataset,executeSemantic,iri} from '../src/cmapss/semantic.ts';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const hash=s=>createHash('sha256').update(s).digest('hex');
const metadata=JSON.parse(read('src/cmapss/datasets.json'));
const schema=JSON.parse(read('src/data/ontologySchema.json'));
const shapes=read('public/cmapss/cmapss-shapes.ttl');
const query=read('public/cmapss/queries/observations.rq');
const assets=new Set(),records=[];
let total=0;
for(const meta of metadata){
 const text=read(meta.dataset==='FD001'?'src/cmapss/replay.json':`public/cmapss/data/${meta.dataset}.json`),d=JSON.parse(text);
 assert.equal(hash(text),meta.replaySHA256);assert.equal(d.dataset,meta.dataset);assert.equal(d.model,meta.model);
 assert.equal(d.baselineSHA256,hash(read('scripts/cmapss/baseline.py')));
 assert.equal(d.exporterSHA256,hash(read(d.dataset==='FD001'?'scripts/cmapss/export.py':'scripts/cmapss/export_subsets.py')));
 assert.equal(d.engines.length,8);assert.equal(d.evaluation.engines,meta.testEngines);
 assert.equal(d.evaluation.endpointRMSE,meta.endpointRMSE);assert.equal(d.evaluation.coverage,meta.coverage);
 assert.deepEqual(Object.keys(d.files).sort(),['RUL','test','train'].map(k=>`${k}_${d.dataset}.txt`).sort());
 const provenance={model:d.model,baselineSHA256:d.baselineSHA256,exporterSHA256:d.exporterSHA256,files:d.files,sensorNumbers:d.sensorNumbers,ontologySHA256:schema.sha256};
 for(const e of d.engines){
  let last=0;
  for(const p of e.points){
   assert.ok(p.cycle>last);last=p.cycle;
   assert.ok(p.low>=0&&p.low<=p.point&&p.point<=p.high&&p.high<=125);
   assert.equal(p.settings.length,3);assert.equal(p.sensors.length,7);
   assert.ok([p.low,p.point,p.high,...p.settings,...p.sensors].every(Number.isFinite));
   assert.ok(!('truth' in p));assert.ok(!('finalRUL' in p));
   assert.ok(decide(p,defaults).chosen.allowed);
   for(const c of compareContracts(p))assert.ok(c.decision.chosen.allowed);
   total++;
  }
  const p=e.points.at(-1),input={dataset:d.dataset,engine:e.id,point:p,scenario:defaults,provenance};
  const result=await executeSemantic(input,shapes,query);
  assert.equal(result.conforms,true);assert.equal(result.rows.length,7);
  assert.ok(result.rows.every(r=>r.source===`test_${d.dataset}.txt`&&r.hash===d.files[r.source]));
  assert.ok(!result.datasetTTL.includes(`RUL_${d.dataset}.txt`));
  const graph=createDataset(input);const asset=graph.store.getQuads(iri(graph.root),iri('cm:asset'),null,null)[0].object.value;
  assert.equal(asset,`urn:cmapss:${d.dataset}:engine:${e.id}`);assert.ok(!assets.has(asset));assets.add(asset);
  const json=evidence(e.id,p,defaults,provenance,d.dataset);assert.equal(json.dataset,d.dataset);assert.ok(json.id.startsWith(d.dataset+'-'));
  assert.equal(comparisonEvidence(e.id,p,provenance,d.dataset).dataset,d.dataset);
 }
 const e=d.engines[0],p=e.points[0];
 const configured=await executeSemantic({dataset:d.dataset,engine:e.id,point:p,scenario:contracts[1].policy,contract:contracts[1],provenance},shapes,read('public/cmapss/queries/contract.rq'));
 assert.ok(configured.conforms);assert.equal(configured.rows[0].contract,'Availability assurance');
 assert.throws(()=>createDataset({dataset:d.dataset,engine:e.id,point:p,scenario:defaults,provenance:{...provenance,model:'wrong-model'}}),/identity mismatch/);
 assert.throws(()=>createDataset({dataset:d.dataset,engine:e.id,point:p,scenario:defaults,provenance:{...provenance,files:{}}}),/Missing source hash/);
 if(d.dataset!=='FD001'){
  const audit=JSON.parse(read(`docs/cmapss/dataset-evidence/${d.dataset}-endpoints.json`));
  assert.equal(audit.endpoints.length,meta.testEngines);assert.deepEqual(audit.sourceFiles,d.files);assert.equal(audit.exporterSHA256,d.exporterSHA256);
  const rmse=Math.sqrt(audit.endpoints.reduce((s,e)=>s+(e.point-e.truth)**2,0)/audit.endpoints.length);
  const coverage=audit.endpoints.filter(e=>e.truth>=e.low&&e.truth<=e.high).length/audit.endpoints.length;
  assert.ok(Math.abs(rmse-meta.endpointRMSE)<1e-10);assert.equal(coverage,meta.coverage);
  for(const e of d.engines){const ref=audit.endpoints.find(r=>r.engine===e.id),p=e.points.at(-1);for(const k of ['low','point','high'])assert.equal(ref[k],p[k]);}
 }
 records.push({dataset:d.dataset,engines:d.engines.length,points:d.engines.reduce((s,e)=>s+e.points.length,0),testEndpoints:meta.testEngines,endpointRMSE:meta.endpointRMSE,coverage:meta.coverage,semanticEndpoints:'8 conforming; exact dataset/source identity',configuredContract:'conforming'});
}
assert.equal(assets.size,32);
if(process.argv.includes('--record')){const dir=new URL('../docs/cmapss/dataset-evidence/',import.meta.url);mkdirSync(dir,{recursive:true});writeFileSync(new URL('verification.json',dir),JSON.stringify({status:'passed',snapshots:total,records},null,2)+'\n');}
console.log(`PASS: ${total} snapshots, 32 distinct assets, four-subset provenance/RDF/contracts, audited endpoint metrics.`);
