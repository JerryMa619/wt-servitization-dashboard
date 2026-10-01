import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { defaults, decide, state, evidence } from '../src/cmapss/model.ts';
const data=JSON.parse(readFileSync(new URL('../src/cmapss/replay.json',import.meta.url)));
const hash=p=>createHash('sha256').update(readFileSync(new URL(p,import.meta.url))).digest('hex');
assert.equal(hash('cmapss/baseline.py'),data.baselineSHA256);
assert.equal(hash('cmapss/export.py'),data.exporterSHA256);
assert.equal(data.engines.length,8);
let count=0;
for(const engine of data.engines){
  let last=0;
  for(const p of engine.points){
    assert.ok(p.cycle>last);last=p.cycle;count++;
    assert.ok(p.low<=p.point&&p.point<=p.high);
    assert.equal(p.sensors.length,data.sensorNumbers.length);
    assert.ok(p.sensors.every(Number.isFinite));
    assert.ok(!('trueRUL' in p));
    for(const consequence of [1,5,10,20,30]){
      const decision=decide(p,{...defaults,consequence});
      assert.ok(decision.chosen.allowed);
      assert.ok(decision.candidates.every(a=>Number.isFinite(a.total)&&a.probability>=0&&a.probability<=1));
      assert.equal(decision.chosen.total,Math.min(...decision.candidates.filter(a=>a.allowed).map(a=>a.total)));
      if(p.low<=defaults.gate)assert.ok(['Planned Maintenance','Derate/Hold'].includes(decision.chosen.name));
    }
  }
}
assert.equal(state(15),'Hold');assert.equal(state(40),'Alert');assert.equal(state(80),'Watch');assert.equal(state(81),'Nominal');
const p={cycle:80,low:16,point:30,high:44,settings:[0,0,100],sensors:[1]};
assert.notEqual(decide(p,{...defaults,consequence:1}).chosen.name,decide(p,{...defaults,consequence:30}).chosen.name);
const original=structuredClone(p),s={...defaults};
const snapshot=evidence(34,p,s,{model:'test'});p.sensors[0]=99;s.consequence=25;
assert.equal(snapshot.observation.sensorValues[0],1);assert.equal(snapshot.scenario.consequence,10);
assert.ok(!JSON.stringify(snapshot).includes('finalRUL'));
const before=decide(original,defaults);const after=decide({...original,trueRUL:0},defaults);
assert.deepEqual(before,after,'Evaluation truth must never affect decisions');
console.log(`PASS: ${count} replay records, source hashes, five cost scenarios, guardrail, units, immutable snapshots and evaluation isolation.`);
