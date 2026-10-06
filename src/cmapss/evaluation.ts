import {decide,type Point,type Scenario} from './model.ts';
import {perturbPoint,sensitivityReport} from './viva.ts';
type Engine={id:number;points:Point[]};
// Retrospective, fixed-cycle complete-case comparison. Never chooses ranges from actions.
export function matchedWindow(engines:Engine[],start=30,end=120){
 if(!Number.isInteger(start)||!Number.isInteger(end)||start>end)throw new Error('Invalid cycle range');
 const included:Engine[]=[],excluded:{engine:number;available:number;required:number}[]=[];
 for(const e of engines){const points=e.points.filter(p=>p.cycle>=start&&p.cycle<=end);const cycles=new Set(points.map(p=>p.cycle));
  if(points.length===end-start+1&&cycles.size===points.length&&points.every(p=>Number.isInteger(p.cycle)))included.push({id:e.id,points});
  else excluded.push({engine:e.id,available:cycles.size,required:end-start+1});
 }
 return {start,end,included,excluded,frames:included.length*(end-start+1),scope:'Retrospective complete-case diagnostic, not a preregistered or representative sample. Equal cycle ranges do not equal degradation stages; short records are excluded explicitly.'};
}
export function mechanismReport(engines:Engine[],policy:Scenario,width=1.25){
 const frames=engines.flatMap(e=>e.points);
 if(!frames.length)throw new Error('Mechanism analysis needs records');
 const rows=[false,true].flatMap(score=>[false,true].map(gate=>{
  let changed=0,gated=0;const transitions:Record<string,number>={};
  for(const p of frames){const q=perturbPoint(p,width),reference=decide(p,policy);
   const ranked=decide(score?q:p,policy).candidates;
   const lower=gate?q.low:p.low;
   const allowed=ranked.filter(a=>lower>policy.gate||a.lead===0);
   const chosen=allowed.reduce((best,a)=>a.total<best.total?a:best);
   if(lower<=policy.gate)gated++;
   if(chosen.name!==reference.chosen.name)changed++;
   const key=`${reference.chosen.name} → ${chosen.name}`;transitions[key]=(transitions[key]??0)+1;
  }
  return {scoreWidth:score?width:1,eligibilityWidth:gate?width:1,changed,gated,transitions};
 }));
 return {frames:frames.length,width,rows,scope:'Analytical mechanism isolation only: scoring width and eligibility bound are changed separately. Mixed rows are synthetic diagnostics, not deployable uncertainty intervals. Counts are not additive causal effects or service outcomes.'};
}
export function evaluationReport(engines:Engine[],policy:Scenario){const matched=matchedWindow(engines);
 return {matched:{...matched,included:matched.included.map(e=>e.id)},sensitivity:matched.included.length?sensitivityReport(matched.included,policy):null,mechanisms:mechanismReport(engines,policy)};
}
export type Endpoint={engine:number;low:number;point:number;high:number;truth:number};
export function intervalAudit(rows:Endpoint[]){
 if(!rows.length)throw new Error('Endpoint audit needs records');
 if(new Set(rows.map(r=>r.engine)).size!==rows.length)throw new Error('Duplicate engine endpoint');
 if(rows.some(r=>![r.low,r.point,r.high,r.truth].every(Number.isFinite)||r.low<0||r.low>r.point||r.point>r.high||r.high>125||r.truth<0))throw new Error('Invalid endpoint');
 const summarise=(rs:Endpoint[])=>({n:rs.length,covered:rs.filter(r=>r.low<=r.truth&&r.truth<=r.high).length,below:rs.filter(r=>r.truth<r.low).length,above:rs.filter(r=>r.truth>r.high).length,coverage:rs.length?rs.filter(r=>r.low<=r.truth&&r.truth<=r.high).length/rs.length:null,meanWidth:rs.length?rs.reduce((s,r)=>s+r.high-r.low,0)/rs.length:null});
 return {all:summarise(rows),withinCap:summarise(rows.filter(r=>r.truth<=125)),aboveCap:summarise(rows.filter(r=>r.truth>125)),nominal:0.8,
 scope:'One endpoint per test engine, uncapped truth. Training residual 10/90 percentiles motivate an 80% reference, not a coverage guarantee. Truth strata are retrospective diagnostics, never decision inputs. No test-set recalibration or operational probability validation.'};
}
