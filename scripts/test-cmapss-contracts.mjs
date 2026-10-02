import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {DataFactory,Parser,Store} from 'n3';
import SHACLValidator from 'rdf-validate-shacl';
import {contracts,capacityBudget,compareContracts,comparisonExamples,comparisonEvidence} from '../src/cmapss/contracts.ts';
import {createDataset,executeSemantic,iri} from '../src/cmapss/semantic.ts';
const data=JSON.parse(readFileSync(new URL('../src/cmapss/replay.json',import.meta.url)));
const schema=JSON.parse(readFileSync(new URL('../src/data/ontologySchema.json',import.meta.url)));
const shapes=readFileSync(new URL('../public/cmapss/cmapss-shapes.ttl',import.meta.url),'utf8');
const query=readFileSync(new URL('../public/cmapss/queries/contract.rq',import.meta.url),'utf8');
const points=data.engines.find(e=>e.id===34).points;
const examples=comparisonExamples(points);
assert.equal(points[examples.cost].cycle,158);assert.equal(points[examples.margin].cycle,171);
const [a,b]=compareContracts(points[examples.cost]);
assert.equal(a.decision.chosen.name,'Continue');assert.equal(b.decision.chosen.name,'Enhanced Monitoring');
const [c,d]=compareContracts(points[examples.margin]);
assert.equal(c.decision.chosen.name,'Enhanced Monitoring');assert.equal(d.decision.chosen.name,'Planned Maintenance');
assert.ok(!c.decision.gated&&d.decision.gated);
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
close(a.budget.allowedLossSlots,10);close(b.budget.allowedLossSlots,2);
close(a.budget.plannedMarginSlots,5);close(b.budget.plannedMarginSlots,-3);
close(a.budget.ifOnePlannedLoss,.975);close(b.budget.ifOnePlannedLoss,.975);
assert.equal(a.budget.plannedFits,true);assert.equal(b.budget.plannedFits,false);
close(capacityBudget({...contracts[0],target:1}).allowedLossSlots,0);
close(capacityBudget({...contracts[0],target:0}).allowedLossSlots,200);
assert.throws(()=>capacityBudget({...contracts[0],periodSlots:0}));
assert.throws(()=>capacityBudget({...contracts[0],plannedLossSlots:201}));
assert.throws(()=>capacityBudget({...contracts[0],target:1.1}));
let count=0;
for(const e of data.engines)for(const p of e.points){
 const before=JSON.stringify(p);const pair=compareContracts(p);
 assert.equal(JSON.stringify(p),before);
 for(const x of pair){assert.ok(x.decision.chosen.allowed);assert.ok(Number.isFinite(x.decision.chosen.total));}
 count++;
}
const provenance={model:data.model,baselineSHA256:data.baselineSHA256,exporterSHA256:data.exporterSHA256,files:data.files,sensorNumbers:data.sensorNumbers,ontologySHA256:schema.sha256};
const records=[];
for(const contract of contracts){
 const input={engine:34,point:points[examples.margin],scenario:{...contract.policy},contract,provenance};
 const r=await executeSemantic(input,shapes,query);
 assert.equal(r.conforms,true);assert.equal(r.rows.length,1);
 assert.equal(r.rows[0].contract,contract.name);close(Number(r.rows[0].target),contract.target);
 close(Number(r.rows[0].allowedLoss),capacityBudget(contract).allowedLossSlots);
 assert.equal(r.rows[0].fits,String(capacityBudget(contract).plannedFits));
 const dataset=createDataset(input);
 const modified=createDataset({...input,contract:{...contract,target:.96}});
 assert.notEqual(dataset.rec,modified.rec,'KPI assumptions must be part of evidence identity');
 assert.equal(dataset.estimate,modified.estimate,'KPI changes do not change prediction');
 assert.throws(()=>createDataset({...input,scenario:{...input.scenario,consequence:999}}),/does not match/);
 // Independently mutate RDF to prove SHACL catches a contract-policy mismatch.
 const policy=dataset.store.getObjects(null,iri('cm:usesPolicy'),null)[0];
 dataset.store.removeQuads(dataset.store.getQuads(policy,iri('cm:guardrailCycles'),null,null));
 dataset.store.addQuad(policy,iri('cm:guardrailCycles'),DataFactory.literal('1.0',iri('xsd:decimal')));
 const validation=await new SHACLValidator(new Store(new Parser().parse(shapes))).validate(dataset.store);
 assert.equal(validation.conforms,false);
 assert.ok(validation.results.some(v=>v.sourceConstraintComponent?.value.endsWith('EqualsConstraintComponent')));
 const noTarget=createDataset(input);
 noTarget.store.removeQuads(noTarget.store.getQuads(null,iri('sdt:targetValue'),null,null));
 assert.equal((await new SHACLValidator(new Store(new Parser().parse(shapes))).validate(noTarget.store)).conforms,false);
 records.push({contract:contract.name,conforms:r.conforms,rows:r.rows,policyMismatchRejected:true,missingTargetRejected:true});
 if(process.argv.includes('--record')){
  const dir=new URL('../docs/cmapss/contract-evidence/',import.meta.url);mkdirSync(dir,{recursive:true});
  writeFileSync(new URL(contract.id+'.ttl',dir),r.datasetTTL);
  writeFileSync(new URL(contract.id+'-report.ttl',dir),r.reportTTL);
 }
}
const exportPoint=structuredClone(points[examples.margin]);
const exported=comparisonEvidence(34,exportPoint,provenance);exportPoint.sensors[0]=999;
assert.notEqual(exported.observation.sensors[0],999);
assert.equal(exported.realizedKPI,'not measured');assert.ok(!('trueRUL' in exported.prediction));assert.ok(!JSON.stringify(exported).includes('finalRUL'));
if(process.argv.includes('--record'))writeFileSync(new URL('../docs/cmapss/contract-evidence/verification.json',import.meta.url),JSON.stringify({records,checkedSnapshots:count,exampleCycles:[158,171],kpiBudgets:{maintenanceSupport:capacityBudget(contracts[0]),availabilityAssurance:capacityBudget(contracts[1])}},null,2)+'\n');
console.log(`PASS: ${count} fixed-evidence comparisons; known cost/margin examples; KPI arithmetic; named policy identity; real SPARQL and SHACL mismatch rejection.`);
