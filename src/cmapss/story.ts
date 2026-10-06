import type { Point } from './model.ts';
export const storySteps = [
{
  "id": "purpose",
  "title": "What part of servitization is being twinned?",
  "tag": "01 · RESEARCH QUESTION",
  "start": 30,
  "end": 30,
  "duration": 16000,
  "modules": [
    0,
    3
  ],
  "text": "Asset condition and service responsibility are connected but distinct. This prototype twins the evidence-to-advice process: recorded degradation, assumed obligations and proposed recommendations. Service delivery remains outside the implemented boundary.",
  "framework": "Define the asset, service participants and responsibility boundaries.",
  "ontology": "Link Asset and Contract so that service context becomes part of the evidence structure.",
  "meaning": "Research question: how can technical condition and service responsibility enter one inspectable decision chain?"
},
{
  "id": "observe",
  "title": "Bring recorded observations into the twin",
  "tag": "02 · OBSERVE",
  "start": 30,
  "end": 94,
  "duration": 18000,
  "modules": [
    0,
    1
  ],
  "text": "Replay operating settings and sensor values from the original test trajectory. Only the current and earlier records are shown. Time is compressed for explanation; this is not a live engine connection.",
  "framework": "OE anchors asset identity; the replay adapter fulfils the data-acquisition responsibilities of DCE.",
  "ontology": "SOSA observations refer to the asset; PROV records source files and cycle windows.",
  "meaning": "Keep each reading connected to its asset, cycle and source so that it can be traced and interpreted."
},
{
  "id": "predict",
  "title": "Estimate life and classify service state",
  "tag": "03 · ESTIMATE",
  "start": 94,
  "end": 158,
  "duration": 18000,
  "modules": [
    2
  ],
  "text": "The DTE uses up to 30 available cycles to estimate RUL. Residual bounds are imperfectly calibrated: endpoint coverage is about 61–78% across subsets. Advice uses an illustrative normal approximation; inspect its sensitivity below.",
  "framework": "DTE provides state estimation and prognosis for the service-decision function.",
  "ontology": "cm:CycleRULEstimate records cycle units, bounds, the generating model and the source window.",
  "meaning": "Make uncertainty and units explicit so that downstream decisions can inspect the evidence they use."
},
{
  "id": "semantics",
  "title": "Connect the architecture through semantic evidence",
  "tag": "04 · CONNECT & QUERY",
  "start": 158,
  "end": 158,
  "duration": 21000,
  "modules": [
    1,
    2,
    4
  ],
  "text": "Follow one snapshot through acquisition, prognosis, contract-context advice and semantic inspection. RDF, SHACL Core and SPARQL execute here. Advice is computed before validation; the ontology does not infer or approve the action.",
  "framework": "Cross-System responsibilities support evidence tracing across processing stages.",
  "ontology": "Types, properties and provenance connect Observation, Estimate and Recommendation into a queryable structure.",
  "meaning": "The framework locates responsibilities; the ontology defines the objects exchanged and the relationships between their evidence."
},
{
  "id": "quality",
  "title": "What happens when a unit is missing?",
  "tag": "05 · CHECK A BROKEN COPY",
  "start": 158,
  "end": 158,
  "duration": 18000,
  "modules": [
    4
  ],
  "text": "Remove the RUL cycle unit from a test copy and run the same SHACL checks. Original observations and predictions remain unchanged. Failure identifies incomplete evidence, not a new engine fault.",
  "framework": "Surface validation results at evidence handoff so users can identify incomplete records.",
  "ontology": "Constraints require explicit cycle units. Cycles are never silently substituted for the source ontology's hours.",
  "meaning": "Semantic constraints expose handoff problems. A SHACL pass does not establish prediction accuracy, action safety or contract compliance."
},
{
  "id": "cost",
  "title": "Same evidence, different responsibility costs",
  "tag": "06 · COMPARE CONTRACTS",
  "start": 158,
  "end": 158,
  "duration": 20000,
  "modules": [
    3
  ],
  "text": "Fix the evidence at cycle 158 and compare two hypothetical contracts. Maintenance support and availability assurance assume different interruption consequences and produce different advice. Neither intervention margin is active here.",
  "framework": "The UE decision function compares service policies against fixed technical evidence.",
  "ontology": "Contract and policy parameters enter the recommendation provenance, explaining why advice changes with service context.",
  "meaning": "The prediction stays fixed while service responsibility changes the action ranking: a reproducible example of servitization in this case."
},
{
  "id": "margin",
  "title": "A stricter policy prompts earlier intervention",
  "tag": "07 · APPLY POLICY",
  "start": 171,
  "end": 171,
  "duration": 21000,
  "modules": [
    2,
    3,
    4
  ],
  "text": "At cycle 171, the lower RUL bound lies between 15 and 25 cycles. The stricter availability-assurance margin excludes operation, monitoring and inspection, recommending planned maintenance. The applied contract is queried here.",
  "framework": "Prediction outputs enter policy constraints to produce advice for human review.",
  "ontology": "Declared contract terms must match the applied policy. RDF binds advice to both the estimate and the contract.",
  "meaning": "Expose the basis for earlier intervention. The hypothetical 99% target does not establish that the contract can be fulfilled."
},
{
  "id": "handoff",
  "title": "Hand over evidence and identify the remaining steps",
  "tag": "08 · EVIDENCE HANDOFF",
  "start": 181,
  "end": 181,
  "duration": 19000,
  "modules": [
    3,
    4
  ],
  "text": "At cycle 181, the baseline policy also recommends maintenance. The prototype can hand over model identity, source hashes, policy, candidate actions and RDF validation results. Human authorization, execution and outcome observation remain ahead.",
  "framework": "Distinguish the implemented evidence chain from the physical service loop that has not been executed.",
  "ontology": "Recommendation status remains proposed. No authorization, execution or post-maintenance observation is fabricated.",
  "meaning": "The practical value is reviewable maintenance planning and responsibility explanation. This dataset cannot establish reduced downtime, savings or improved actual availability."
},
{
  "id": "contributions",
  "title": "What does this case study contribute?",
  "tag": "09 · CONTRIBUTIONS & LIMITS",
  "start": 181,
  "end": 181,
  "duration": 23000,
  "modules": [
    0,
    1,
    2,
    3,
    4
  ],
  "text": "Three candidate contributions have implementation evidence. Each still needs a research comparison: architecture reuse, semantic advantage over conventional structures, and decision robustness or outcomes.",
  "framework": "Provide a decomposition of responsibilities and connections between functions.",
  "ontology": "Provide object semantics, provenance relationships and executable structural constraints.",
  "meaning": "Together, responsibilities have an implementation location, exchanged data has explicit meaning, and advice has queryable support. Theoretical novelty still requires comparison with prior research."
}
] as const;
export type PlayerState = {index:number;elapsed:number;playing:boolean;finished:boolean};
export type PlayerAction = {type:'tick';delta:number;ready:boolean}|{type:'goto';index:number}|{type:'toggle'}|{type:'restart'}|{type:'pause'};
export const initialPlayer:PlayerState={index:0,elapsed:0,playing:true,finished:false};
export function storyReducer(s:PlayerState,a:PlayerAction):PlayerState {
 if(a.type==='pause')return {...s,playing:false};
 if(a.type==='restart')return {...initialPlayer};
 if(a.type==='goto')return {index:Math.max(0,Math.min(storySteps.length-1,a.index)),elapsed:0,playing:false,finished:false};
 if(a.type==='toggle')return s.finished?{...initialPlayer}:{...s,playing:!s.playing};
 if(!s.playing||!a.ready)return s;
 const elapsed=s.elapsed+Math.max(0,a.delta);
 if(elapsed<storySteps[s.index].duration)return {...s,elapsed};
 if(s.index===storySteps.length-1)return {...s,elapsed:storySteps[s.index].duration,playing:false,finished:true};
 return {index:s.index+1,elapsed:0,playing:true,finished:false};
}
export function storyPoint(points:Point[],index:number,elapsed:number) {
 const step=storySteps[index];
 const cycle=Math.round(step.start+(step.end-step.start)*Math.min(1,elapsed/(step.duration*.65)));
 const p=points.find(p=>p.cycle===cycle);
 if(!p)throw new Error(`Missing observed cycle ${cycle}`);
 return p;
}
export const semanticStages:Record<string,{cycle:number;defect:'none'|'missing-unit';contract:boolean;query:string;expected:boolean}>={
 semantics:{cycle:158,defect:'none',contract:false,query:'evidence',expected:true},
 quality:{cycle:158,defect:'missing-unit',contract:false,query:'evidence',expected:false},
 margin:{cycle:171,defect:'none',contract:true,query:'contract',expected:true},
 handoff:{cycle:181,defect:'none',contract:false,query:'evidence',expected:true}
};
