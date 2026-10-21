import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runEvidenceComparison,conventionalCheck,comparisonFixtures,comparisonDataset,comparisonShapes} from '../src/cmapss/evidenceComparison.ts';
import {contracts} from '../src/cmapss/contracts.ts';
import {Store,Parser} from 'n3';
import Validator from 'rdf-validate-shacl';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const d=read('src/cmapss/replay.json');
const input={dataset:'FD001',engine:34,point:d.engines.find(e=>e.id===34).points.find(p=>p.cycle===171),scenario:contracts[1].policy,contract:contracts[1],provenance:{...d,ontologySHA256:read('src/data/ontologySchema.json').sha256}};
const before=JSON.stringify(input);const result=await runEvidenceComparison(input);assert.equal(JSON.stringify(input),before);
assert.equal(result.results.length,7);
assert.equal(result.stressResults.length,35);
for(const r of [...result.results,...result.stressResults]){assert.ok(r.matchesExpected,r.name);assert.ok(r.queryParity,r.name);assert.equal(r.conforms,r.expected.length===0);assert.ok(r.datasetTTL.length);assert.ok(r.reportTTL.length);}
// Additional combined defects and nonempty malformed source exercise more than single showcase cases.
const f=comparisonFixtures(input)[0].fixture;
f.estimate.unit='hours';f.estimate.asset='urn:wrong';f.estimate.source='not-a-hash';f.recommendation.version='old';delete f.recommendation.estimate;
assert.deepEqual(conventionalCheck(f),['R1','R2','R3','R4','R5']);
const report=await new Validator(new Store(new Parser().parse(comparisonShapes))).validate(comparisonDataset(f));
assert.equal(report.conforms,false);assert.deepEqual([...new Set(report.results.map(r=>r.sourceShape.value.split(':').at(-1)))].sort(),['R1','R2','R3','R4','R5']);
// Queryability and validity are deliberately independent.
assert.equal(result.results.find(r=>r.name==='Wrong asset link').jsRows.length,1);
assert.equal(result.results.find(r=>r.name==='Missing estimate link').jsRows.length,0);
if(process.argv.includes('--record')){const dir=new URL('../docs/cmapss/comparison-evidence/',import.meta.url);mkdirSync(dir,{recursive:true});const hash=s=>createHash('sha256').update(s).digest('hex');writeFileSync(new URL('bounded-comparison.json',dir),JSON.stringify({...result,shapesSHA256:hash(result.comparisonShapes),fixturesSHA256:hash(JSON.stringify([...result.results,...result.stressResults].map(r=>r.fixture)))},null,2)+'\n');}
console.log('PASS: seven equal-requirement JSON/SHACL fixtures, provenance query parity, actual reports, combined defects and unchanged input.');
