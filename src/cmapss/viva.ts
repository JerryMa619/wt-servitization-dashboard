import {decide, type Point, type Scenario} from './model.ts';

export const caseRoles = [
 {name:'Micro wind turbine',focus:'How does the service process operate?',evidence:'Simulated condition → service selection → downtime and repair → updated state; policy cost comparison and semantic evidence.',boundary:'Reference-assisted / simulated condition, pseudo-hour RUL and assumed economics. No independent field intervention validation.'},
 {name:'C-MAPSS',focus:'How is a service recommendation justified?',evidence:'Original degradation observations → prefix-only prognosis → explicit contract assumptions → queryable recommendation evidence.',boundary:'NASA simulation benchmark replay; no maintenance trajectories, real contracts or measured service outcomes. No physical closed loop.'}
];
export const contributionEvidence = [
 {claim:'C1 · Service-responsibility mapping',implemented:'Observation, prognosis and advice have explicit locations in the framework.',evidence:'Trace one snapshot through DCE, DTE, UE and evidence support.',missing:'Comparison with prior architectures and evaluation of reuse; full ISO conformance is not established.'},
 {claim:'C2 · Inspectable semantic evidence',implemented:'Asset, cycle unit, estimate, model, policy and recommendation are linked.',evidence:'Executed SPARQL and SHACL; the deliberately unit-free copy fails.',missing:'Fair conventional-schema baseline, heterogeneous-source mapping and competency-question coverage. Basic validation is not ontology-exclusive.'},
 {claim:'C3 · Contract-context advice',implemented:'The same technical evidence can lead to different advice under declared assumptions.',evidence:'Cycles 158/171 plus replay sensitivity and a threshold-only comparator.',missing:'Empirical contract parameters, calibrated uncertainty and prospective outcome evaluation. Different advice is not proof of better advice.'}
];
export const handoffSteps = [
 {owner:'DCE · replay adapter',object:'Asset + Observation + Window',check:'Keep dataset, engine, cycle and source identity together.'},
 {owner:'DTE · prognosis',object:'CycleRULEstimate + Model',check:'Expose prefix predictions, bounds, cycle units and generating model.'},
 {owner:'UE · advisory function',object:'Contract + Policy + Recommendation',check:'Compute advice in TypeScript; bind the applied policy to the estimate.'},
 {owner:'CS · evidence support',object:'RDF + query + SHACL report',check:'Materialise and inspect the advice already computed; no OWL decision inference.'},
 {owner:'Maintenance planner · future handoff',object:'Proposed recommendation + evidence',check:'Review quality and assumptions. Authorisation, work execution and outcomes are not implemented.'}
];
export const examinerQuestions:Record<string,{question:string;answer:string;remaining:string}>= {
 purpose:{question:'What exactly is being twinned?',answer:'Asset evidence is connected to a representation of service responsibility and proposed advice. Only the evidence-to-advice part of the service process is implemented.',remaining:'The physical authorisation, intervention and outcome loop is absent.'},
 observe:{question:'Is this live or field evidence?',answer:'These are original records from the C-MAPSS simulation benchmark, replayed by cycle. Current and prior observations generate the exported prediction.',remaining:'A benchmark replay does not establish field connectivity or transferability.'},
 predict:{question:'Can the uncertainty support the recommendation?',answer:'Residual bounds and a normal approximation feed an illustrative cost rule. Empirical endpoint coverage varies from about 61% to 78%.',remaining:'The intervals and derived probabilities are not guaranteed calibrated. Review sensitivity before interpreting advice.'},
 semantics:{question:'Why ontology instead of a conventional schema?',answer:'Named relationships make evidence traversable and constraints executable. This run proves those capabilities, not their superiority over a well-designed conventional system.',remaining:'Compare equal requirements, defect sets, queries and change tasks with a conventional implementation.'},
 quality:{question:'Does a failed SHACL check block the decision?',answer:'No. Advice is computed before RDF validation. This scene exposes invalid evidence in a test copy; it is not an operational decision gate.',remaining:'An enforced approval gate would need a separate implementation and end-to-end tests.'},
 cost:{question:'Did you build the preferred answer into the costs?',answer:'Costs are explicit demonstration assumptions. Fixed-evidence comparisons and the sensitivity table expose their influence.',remaining:'No empirical cost validation or realised savings is supplied.'},
 margin:{question:'Is earlier intervention better?',answer:'A stricter margin changes eligibility. It does not establish a superior policy or fulfil the independent availability budget.',remaining:'Lead times, calibration, feasible maintenance and outcomes require validation.'},
 handoff:{question:'Is the service loop closed?',answer:'No. The export is an evidence handoff for human review; recommendation status remains proposed.',remaining:'The benchmark has no post-maintenance observations or actual service delivery records.'},
 contributions:{question:'What is the original research contribution?',answer:'These are candidate contributions supported by implementation evidence. The contribution matrix separates what works from what still needs comparison.',remaining:'Prior-work comparison and the outstanding evaluations are necessary before claiming novelty or operational benefit.'}
};

export function perturbPoint(p:Point,width:number):Point {
 return {...p,low:Math.max(0,p.point-(p.point-p.low)*width),high:Math.min(125,p.point+(p.high-p.point)*width)};
}
export function sensitivityReport(engines:{id:number;points:Point[]}[],policy:Scenario) {
 const frames=engines.flatMap(e=>e.points.map(p=>({engine:e.id,p})));
 if(!frames.length)throw new Error('Sensitivity analysis needs replay records');
 const variants=[
  {name:'Reference',change:{},width:1},
  {name:'Consequence ×0.75',change:{consequence:policy.consequence*.75},width:1},
  {name:'Consequence ×1.25',change:{consequence:policy.consequence*1.25},width:1},
  {name:'Intervention margin −5 cycles',change:{gate:Math.max(0,policy.gate-5)},width:1},
  {name:'Intervention margin +5 cycles',change:{gate:policy.gate+5},width:1},
  {name:'Waiting periods ×0.75',change:{leadMultiplier:policy.leadMultiplier*.75},width:1},
  {name:'Waiting periods ×1.25',change:{leadMultiplier:policy.leadMultiplier*1.25},width:1},
  {name:'Interval width ×0.75',change:{},width:.75},
  {name:'Interval width ×1.25',change:{},width:1.25}
 ];
 const rows=variants.map(v=>{
  const scenario={...policy,...v.change};let changed=0,thresholdDisagreements=0;const actionCounts:Record<string,number>={};
  for(const {p} of frames){
   const q=perturbPoint(p,v.width),decision=decide(q,scenario);
   const thresholdAction=q.low<=scenario.gate?'Planned Maintenance':'Continue';
   if(decision.chosen.name!==decide(p,policy).chosen.name)changed++;
   if(decision.chosen.name!==thresholdAction)thresholdDisagreements++;
   actionCounts[decision.chosen.name]=(actionCounts[decision.chosen.name]??0)+1;
  }
  return {name:v.name,policy:scenario,intervalWidthMultiplier:v.width,changed,changedFraction:changed/frames.length,thresholdDisagreements,actionCounts};
 });
 return {dataset:'FD001',engineIds:engines.map(e=>e.id),frames:frames.length,referencePolicy:policy,rows,
  scope:'Descriptive replay sensitivity on eight selected engines; correlated snapshots, not independent trials or a representative fleet. No outcome or benefit estimate.',
  comparator:'Threshold only: Planned Maintenance when lower bound <= the same scenario margin; Continue otherwise. Different actions do not imply better actions.',
  perturbation:'One factor at a time. Width scales distance from the fixed point estimate and clips bounds to 0–125 cycles; it does not recalibrate uncertainty.',
  decisionAssumptions:'Cost = direct cost + assumed consequence × normal-approximation probability within an action waiting period. Maintenance has zero waiting period and zero modeled pre-intervention exposure; execution and residual risk are not modeled.'};
}
