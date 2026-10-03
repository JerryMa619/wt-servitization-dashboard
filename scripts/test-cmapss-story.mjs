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
