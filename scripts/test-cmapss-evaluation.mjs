import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {matchedWindow,evaluationReport,intervalAudit,mechanismReport} from '../src/cmapss/evaluation.ts';
import {contracts} from '../src/cmapss/contracts.ts';
import {decide} from '../src/cmapss/model.ts';
import {perturbPoint} from '../src/cmapss/viva.ts';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const hash=p=>createHash('sha256').update(readFileSync(new URL('../'+p,import.meta.url))).digest('hex');
const d=read('src/cmapss/replay.json'),saved=read('src/cmapss/evaluation-evidence.json'),before=JSON.stringify(d);
const m=matchedWindow(d.engines);assert.equal(m.frames,637);assert.equal(m.included.length,7);assert.deepEqual(m.excluded,[{engine:1,available:2,required:91}]);
for(const e of m.included)assert.deepEqual(e.points.map(p=>p.cycle),Array.from({length:91},(_,i)=>i+30));
const altered=structuredClone(m.included[0]);altered.points[0].cycle=30.5;assert.equal(matchedWindow([altered]).included.length,0);
assert.throws(()=>matchedWindow(d.engines,120,30));
for(const c of contracts){const r=evaluationReport(d.engines,c.policy);assert.deepEqual(saved.contracts.find(v=>v.id===c.id),{id:c.id,policy:c.policy,...r});
 assert.equal(r.mechanisms.rows[0].changed,0);
 for(const row of r.mechanisms.rows)assert.equal(Object.values(row.transitions).reduce((a,b)=>a+b,0),1233);
 const joint=d.engines.flatMap(e=>e.points).filter(p=>decide(perturbPoint(p,1.25),c.policy).chosen.name!==decide(p,c.policy).chosen.name).length;
 assert.equal(r.mechanisms.rows[3].changed,joint);
 assert.ok(Math.abs(r.sensitivity.rows[8].changedFraction-r.sensitivity.rows[8].equalEngineChangedFraction)<1e-12);
}
assert.equal(saved.contracts[1].sensitivity.rows[8].changed,4);
// Boundary truth 125 is in the within-cap group; above-cap truth cannot be covered.
const fixture=[{engine:1,low:10,point:20,high:30,truth:5},{engine:2,low:100,point:110,high:125,truth:125},{engine:3,low:100,point:120,high:125,truth:126}];
const a=intervalAudit(fixture);assert.deepEqual([a.all.n,a.all.covered,a.all.below,a.all.above],[3,1,1,1]);assert.equal(a.aboveCap.n,1);assert.equal(a.aboveCap.coverage,0);assert.equal(intervalAudit([fixture[0]]).aboveCap.coverage,null);
assert.throws(()=>intervalAudit([fixture[0],fixture[0]]));assert.throws(()=>intervalAudit([{...fixture[0],high:NaN}]));
for(const r of saved.intervals){const path=`docs/cmapss/dataset-evidence/${r.dataset}-endpoints.json`,f=read(path),computed=intervalAudit(f.endpoints);assert.equal(hash(path),r.endpointsSHA256);assert.deepEqual(computed.all,r.all);assert.deepEqual(computed.withinCap,r.withinCap);assert.deepEqual(computed.aboveCap,r.aboveCap);assert.equal(r.all.n,r.withinCap.n+r.aboveCap.n);assert.equal(r.all.covered+r.all.below+r.all.above,r.all.n);assert.equal(r.aboveCap.covered,0);const meta=read('src/cmapss/datasets.json').find(x=>x.dataset===r.dataset);assert.equal(r.all.coverage,meta.coverage);assert.equal(r.all.n,meta.testEngines);}
assert.equal(saved.replaySHA256,hash('src/cmapss/replay.json'));assert.equal(saved.evaluationCodeSHA256,hash('src/cmapss/evaluation.ts'));assert.equal(JSON.stringify(d),before);
console.log('PASS: matched-cycle exclusions, mechanism decomposition, frozen endpoint reconciliation, cap strata, boundaries and artifact hashes.');
