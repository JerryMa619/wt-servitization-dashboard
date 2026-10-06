import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {storySteps,storyReducer,storyPoint,initialPlayer,semanticStages} from '../src/cmapss/story.ts';
import {decide,defaults} from '../src/cmapss/model.ts';
import {compareContracts,contracts} from '../src/cmapss/contracts.ts';
import {executeSemantic} from '../src/cmapss/semantic.ts';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const d=JSON.parse(read('src/cmapss/replay.json')),points=d.engines.find(e=>e.id===34).points;
let state={...initialPlayer};
assert.deepEqual(storyReducer(state,{type:'tick',delta:100000,ready:false}),state,'must wait for actual semantics');
const paused=storyReducer(state,{type:'pause'});assert.deepEqual(storyReducer(paused,{type:'tick',delta:100000,ready:true}),paused);
for(let i=0;i<storySteps.length;i++){
 assert.equal(state.index,i);
 for(const elapsed of [0,1000,storySteps[i].duration]){
  const p=storyPoint(points,i,elapsed);assert.ok(points.includes(p));assert.ok(p.cycle>=storySteps[i].start&&p.cycle<=storySteps[i].end);
 }
 state=storyReducer(state,{type:'tick',delta:storySteps[i].duration,ready:true});
}
assert.equal(state.finished,true);assert.equal(state.playing,false);assert.equal(state.index,8);
assert.deepEqual(storyReducer(state,{type:'restart'}),initialPlayer);
assert.equal(storyReducer(state,{type:'goto',index:3}).playing,false);
assert.equal(storyReducer(state,{type:'goto',index:99}).index,8);
assert.equal(storyReducer(state,{type:'goto',index:-1}).index,0);
assert.deepEqual(compareContracts(storyPoint(points,5,0)).map(x=>x.decision.chosen.name),['Continue','Enhanced Monitoring']);
assert.deepEqual(compareContracts(storyPoint(points,6,0)).map(x=>x.decision.chosen.name),['Enhanced Monitoring','Planned Maintenance']);
assert.equal(decide(storyPoint(points,7,0),defaults).chosen.name,'Planned Maintenance');
for(const [stage,r] of Object.entries(semanticStages)){
 const result=await executeSemantic({dataset:'FD001',engine:34,point:points.find(p=>p.cycle===r.cycle),scenario:r.contract?contracts[1].policy:defaults,contract:r.contract?contracts[1]:undefined,provenance:{...d,ontologySHA256:JSON.parse(read('src/data/ontologySchema.json')).sha256}},read('public/cmapss/cmapss-shapes.ttl'),read(`public/cmapss/queries/${r.query}.rq`),r.defect);
 assert.equal(result.conforms,r.expected,stage);assert.ok(r.expected?result.rows.length>0:result.violations.length>0);
}
console.log('PASS: nine-scene player lifecycle, semantic waiting, observed-only frames, both contract comparisons and actual semantic outcomes.');

// Viva analysis uses the production advisory rule, without future truth or outcomes.
const {sensitivityReport,perturbPoint}=await import('../src/cmapss/viva.ts');
for(const c of contracts){
 const report=sensitivityReport(d.engines,c.policy);
 assert.equal(report.frames,1233);assert.equal(report.rows.length,9);assert.equal(report.rows[0].changed,0);
 for(const row of report.rows){
  assert.equal(Object.values(row.actionCounts).reduce((a,b)=>a+b,0),report.frames);
  assert.ok(row.changed>=0&&row.changed<=report.frames);
  assert.ok(row.thresholdDisagreements>=0&&row.thresholdDisagreements<=report.frames);
 }
 const reference=report.rows[0];
 const manual=d.engines.flatMap(e=>e.points).filter(p=>decide(p,c.policy).chosen.name!==(p.low<=c.policy.gate?'Planned Maintenance':'Continue')).length;
 assert.equal(reference.thresholdDisagreements,manual);
 const original=JSON.stringify(d.engines);sensitivityReport(d.engines,c.policy);assert.equal(JSON.stringify(d.engines),original);
 const noTruth=d.engines.map(e=>({id:e.id,points:e.points.map(p=>({cycle:p.cycle,point:p.point,low:p.low,high:p.high,settings:p.settings,sensors:p.sensors}))}));
 assert.deepEqual(sensitivityReport(noTruth,c.policy),report);
}
const p={cycle:1,point:50,low:30,high:70,settings:[],sensors:[]};
assert.equal(perturbPoint(p,1.25).low,25);assert.equal(perturbPoint(p,1.25).high,75);
assert.throws(()=>sensitivityReport([],defaults));
const edge={...p,low:0,high:125};assert.equal(perturbPoint(edge,1.25).low,0);assert.equal(perturbPoint(edge,1.25).high,125);
console.log('PASS: viva sensitivity denominators, unchanged reference, threshold comparison, bounded perturbations, no mutation or evaluation-label dependency.');
