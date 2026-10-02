export type DatasetId = 'FD001' | 'FD002' | 'FD003' | 'FD004';
export type Point = { cycle: number; low: number; point: number; high: number; settings: number[]; sensors: number[] };
export type Scenario = { consequence: number; maintenance: number; leadMultiplier: number; gate: number };
export const defaults: Scenario = { consequence: 10, maintenance: 1, leadMultiplier: 1, gate: 15 };
export const actions = [
  { name: 'Continue', direct: 0, lead: 20 },
  { name: 'Enhanced Monitoring', direct: .05, lead: 10 },
  { name: 'Inspection', direct: .15, lead: 5 },
  { name: 'Planned Maintenance', direct: 1, lead: 0 },
  { name: 'Derate/Hold', direct: 1.3, lead: 0 }
];
export function state(low: number) { return low <= 15 ? 'Hold' : low <= 40 ? 'Alert' : low <= 80 ? 'Watch' : 'Nominal'; }
export function cdf(value: number, mean: number, sd: number) {
  const z = (value - mean) / (sd * Math.sqrt(2));
  const t = 1 / (1 + .3275911 * Math.abs(z));
  const erf = Math.sign(z) * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-z * z));
  return .5 * (1 + erf);
}
export function decide(p: Pick<Point, 'low' | 'point' | 'high'>, s: Scenario) {
  const sigma = Math.max((p.high - p.low) / (2 * 1.2815515655446004), 1);
  const candidates = actions.map(a => {
    const lead = a.lead * s.leadMultiplier;
    const probability = lead === 0 ? 0 : cdf(lead, p.point, sigma);
    const direct = a.name === 'Planned Maintenance' ? s.maintenance : a.direct;
    return { ...a, direct, lead, probability, riskCost: s.consequence * probability,
      total: direct + s.consequence * probability, allowed: p.low > s.gate || a.lead === 0 };
  });
  const chosen = candidates.filter(a => a.allowed).reduce((best,a) => a.total < best.total ? a : best);
  return { candidates, chosen, gated: p.low <= s.gate };
}
export function evidence(engine: number, p: Point, scenario: Scenario, provenance: object, dataset: DatasetId = 'FD001') {
  return { id: `${dataset}-${engine}-cycle-${p.cycle}`, dataset, engine, cycle: p.cycle,
    mode: 'dataset replay / advisory only', units: 'cycles', observation: { settings: [...p.settings], sensorValues: [...p.sensors] },
    prediction: { low: p.low, point: p.point, high: p.high }, serviceState: state(p.low),
    scenario: { ...scenario }, decision: decide(p, scenario), provenance,
    semantics: { representation: 'Application JSON; RDF can be generated in Semantic check', cycleRUL: 'cm:CycleRULEstimate with explicit cm:Cycle; not sdt:*RULhours', reasoning: 'OWL inference not executed', shacl: 'Not recorded by this JSON export; use the separate SHACL report for a validated snapshot' },
    execution: 'not performed', outcome: 'not observed' };
}
