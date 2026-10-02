import { decide, type Point, type Scenario, type DatasetId } from './model.ts';

export type ContractTerms = {
  id: string; version: string; name: string; responsibility: string;
  policy: Scenario; target: number; periodSlots: number; plannedLossSlots: number; unplannedLossSlots: number;
};
// Research assumptions, not extracted contract terms or measured aviation costs.
export const contracts: readonly ContractTerms[] = [
  { id:'maintenance-support', version:'1', name:'Maintenance support',
    responsibility:'Provider supports maintenance planning; lower assumed exposure to service interruption.',
    policy:{consequence:5,maintenance:1,leadMultiplier:1,gate:15},
    target:.95,periodSlots:200,plannedLossSlots:5,unplannedLossSlots:20 },
  { id:'availability-assurance', version:'1', name:'Availability assurance',
    responsibility:'Provider assumes greater service-interruption exposure and an earlier intervention margin.',
    policy:{consequence:20,maintenance:1,leadMultiplier:1,gate:25},
    target:.99,periodSlots:200,plannedLossSlots:5,unplannedLossSlots:20 }
];
export function matchesPolicy(contract: ContractTerms, scenario: Scenario) {
  return (Object.keys(contract.policy) as (keyof Scenario)[]).every(k=>contract.policy[k]===scenario[k]);
}
export function capacityBudget(c: ContractTerms) {
  if(!Number.isFinite(c.target)||c.target<0||c.target>1||!Number.isFinite(c.periodSlots)||c.periodSlots<=0||
     [c.plannedLossSlots,c.unplannedLossSlots].some(v=>!Number.isFinite(v)||v<0||v>c.periodSlots)) throw new Error('Invalid capacity-budget assumptions');
  const allowedLossSlots=(1-c.target)*c.periodSlots;
  return { allowedLossSlots, plannedMarginSlots:allowedLossSlots-c.plannedLossSlots,
    ifOnePlannedLoss:1-c.plannedLossSlots/c.periodSlots, ifOneUnplannedLoss:1-c.unplannedLossSlots/c.periodSlots,
    plannedFits:c.plannedLossSlots<=allowedLossSlots+1e-9,
    unit:'scheduled cycle opportunities', status:'hypothetical single-loss budget; not measured time availability' };
}
export function compareContracts(p: Point) {
  return contracts.map(c=>({terms:c,budget:capacityBudget(c),decision:decide(p,c.policy)}));
}
export function comparisonExamples(points: Point[]) {
  const cost=points.findIndex(p=>{const [a,b]=compareContracts(p);return !a.decision.gated&&!b.decision.gated&&a.decision.chosen.name!==b.decision.chosen.name;});
  const margin=points.findIndex(p=>{const [a,b]=compareContracts(p);return !a.decision.gated&&b.decision.gated&&a.decision.chosen.name!==b.decision.chosen.name;});
  return {cost,margin};
}
export function comparisonEvidence(engine:number,p:Point,provenance:object,dataset:DatasetId='FD001') {
  return JSON.parse(JSON.stringify({version:'0.4.0',engine,cycle:p.cycle,dataset,
    observation:{settings:p.settings,sensors:p.sensors},prediction:{low:p.low,point:p.point,high:p.high,unit:'cycles'},
    comparisons:compareContracts(p),provenance,
    calculation:'Allowed lost slots = (1 − target) × period slots; margin = allowed − assumed loss. This KPI budget does not enter the cost optimizer.',
    assumptionsSource:'Demonstration design; not NASA contract data. See docs/cmapss/CONTRACT_SCENARIOS.md.',
    execution:'not performed',realizedKPI:'not measured'}));
}
