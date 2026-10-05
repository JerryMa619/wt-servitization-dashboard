import { conditionPrediction, conditionState, crackGrowthRate, operatingOutput } from '../model/operating.ts';
import { estimateTcs, isRiskAcceptableAfterAction, maintenanceActions, residualRiskAfterAction, serviceDecisionByTcs, tcsParameters, type MaintenanceActionKey, type ServiceCostEstimate } from '../model/service.ts';
import { rulModel } from '../model/xgboost.ts';

export const policies = [
  { id: 'fixed', label: 'Fixed interval' }, { id: 'threshold', label: 'Crack threshold' },
  { id: 'rul', label: 'RUL only' }, { id: 'tcs', label: 'RUL + TCS' }
] as const;
export type Policy = typeof policies[number]['id'];
export type ExperimentConfig = { horizon: number; initialCrack: number; windSpeed: number; fixedInterval: number; downtimeScale: number; consequenceScale: number; repairScale: number };
export const defaultExperiment: ExperimentConfig = { horizon: 120, initialCrack: 0, windSpeed: 8, fixedInterval: 40, downtimeScale: 1, consequenceScale: 1, repairScale: 1 };
export function validateExperiment(config: ExperimentConfig) {
  const limits: Record<keyof ExperimentConfig, [number, number]> = { horizon: [24, 240], initialCrack: [0, 80], windSpeed: [3, 12], fixedInterval: [12, 120], downtimeScale: [.25, 3], consequenceScale: [.25, 3], repairScale: [.5, 1.5] };
  for (const [name, [min, max]] of Object.entries(limits)) { const value = config[name as keyof ExperimentConfig]; if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${name} must be between ${min} and ${max}`); }
  if (!Number.isInteger(config.horizon) || !Number.isInteger(config.fixedInterval)) throw new Error('Horizon and interval must be integer modeled hours');
}
export function experimentWind(config: ExperimentConfig, hour: number) {
  return Number(Math.max(0, Math.min(40, config.windSpeed + 1.2 * Math.sin(hour / 12) + .4 * Math.sin(hour / 3))).toFixed(1));
}
function reading(wind: number, crack: number) {
  const point = { t: 'Experiment', source: 'auto-simulation', modelVersion: rulModel.version, windSpeed: wind, windDirection: 226, crackMm: crack, ...operatingOutput(wind), ...conditionPrediction(wind, crack) };
  return { ...point, serviceState: conditionState(point) };
}
export type ExperimentEvent = { startH: number; action: MaintenanceActionKey; plannedH: number; elapsedH: number; completed: boolean; crackBefore: number; projectedCrackAfter: number; riskAccepted: boolean; directAndLogistics: number; incurredDowntime: number; incurredContract: number };
export type PolicyResult = { policy: Policy; cost: number; incurredCost: number; terminalRiskAllowance: number; downtimeH: number; servicesStarted: number; servicesCompleted: number; unsafeOperatingH: number; rejectedRepairCount: number; finalCrack: number; events: ExperimentEvent[]; series: { hour: number; crack: number; incurredCost: number; downtimeH: number }[] };
export function runPolicy(config: ExperimentConfig, policy: Policy): PolicyResult {
  validateExperiment(config);
  let crack = config.initialCrack, nextFixed = config.fixedInterval, downtimeH = 0, incurredCost = 0, unsafeOperatingH = 0;
  let active: { event: ExperimentEvent; estimate: ServiceCostEstimate } | null = null;
  const events: ExperimentEvent[] = [], series = [{ hour: 0, crack, incurredCost, downtimeH }];
  for (let hour = 0; hour < config.horizon; hour++) {
    const point = reading(experimentWind(config, hour), crack);
    if (!active) {
      let action: MaintenanceActionKey | null = null;
      // Every policy shares the same 80 mm demo safety ceiling, not a learned failure model.
      if (crack >= 80) action = 'corrective-maintenance';
      else if (policy === 'fixed' && hour >= nextFixed) { action = 'predictive-maintenance'; nextFixed = hour + config.fixedInterval; }
      else if (policy === 'threshold' && crack >= 45) action = 'predictive-maintenance';
      else if (policy === 'rul' && point.rulP10 < 360) action = 'predictive-maintenance';
      else if (policy === 'tcs') {
        const selected = serviceDecisionByTcs(point, point.serviceState, config);
        if (maintenanceActions[selected.action].crackReduction > 0 && (crack >= 45 || point.rulP10 < 360 || selected.residualRiskScore > .42)) action = selected.action;
      }
      if (action) {
        const estimate = estimateTcs(point, action, undefined, config), plannedH = maintenanceActions[action].defaultDowntimeH;
        const event: ExperimentEvent = { startH: hour, action, plannedH, elapsedH: 0, completed: false, crackBefore: crack, projectedCrackAfter: estimate.residualCrackMm, riskAccepted: isRiskAcceptableAfterAction(point, estimate, point.serviceState), directAndLogistics: estimate.directCost + estimate.logisticsCost, incurredDowntime: 0, incurredContract: 0 };
        incurredCost += event.directAndLogistics; events.push(event); active = { event, estimate };
      }
    }
    if (active) {
      const { event, estimate } = active;
      event.elapsedH++; downtimeH++;
      event.incurredDowntime += estimate.downtimeCost / event.plannedH;
      event.incurredContract += estimate.contractCost / event.plannedH;
      incurredCost += (estimate.downtimeCost + estimate.contractCost) / event.plannedH;
      if (event.elapsedH === event.plannedH) { crack = event.projectedCrackAfter; event.completed = true; active = null; }
    } else {
      if (crack >= 60 || point.rulP10 < 240) unsafeOperatingH++;
      crack = Number(Math.min(80, crack + crackGrowthRate(point, crack, hour)).toFixed(1));
    }
    series.push({ hour: hour + 1, crack, incurredCost, downtimeH });
  }
  const terminal = reading(experimentWind(config, config.horizon), crack);
  const risk = residualRiskAfterAction(terminal, crack, terminal.rulP10);
  const terminalRiskAllowance = risk ** 2 * tcsParameters.unplannedFailureConsequence * config.consequenceScale;
  return { policy, cost: incurredCost + terminalRiskAllowance, incurredCost, terminalRiskAllowance, downtimeH,
    servicesStarted: events.length, servicesCompleted: events.filter(e => e.completed).length, unsafeOperatingH,
    rejectedRepairCount: events.filter(e => !e.riskAccepted).length, finalCrack: crack, events, series };
}
export function runComparison(config: ExperimentConfig) {
  validateExperiment(config);
  const results = policies.map(p => runPolicy(config, p.id));
  const changes: { label: string; config: ExperimentConfig }[] = [
    { label: 'Current assumptions', config },
    { label: 'Consequence -25%', config: { ...config, consequenceScale: Math.max(.25, config.consequenceScale * .75) } },
    { label: 'Consequence +25%', config: { ...config, consequenceScale: Math.min(3, config.consequenceScale * 1.25) } },
    { label: 'Downtime price -25%', config: { ...config, downtimeScale: Math.max(.25, config.downtimeScale * .75) } },
    { label: 'Downtime price +25%', config: { ...config, downtimeScale: Math.min(3, config.downtimeScale * 1.25) } },
    { label: 'Repair efficacy -25%', config: { ...config, repairScale: Math.max(.5, config.repairScale * .75) } },
    { label: 'Repair efficacy +25%', config: { ...config, repairScale: Math.min(1.5, config.repairScale * 1.25) } }
  ];
  const sensitivity = changes.map(({ label, config: variant }, i) => {
    const outcomes = i === 0 ? results : policies.map(p => runPolicy(variant, p.id));
    const cheapest = [...outcomes].sort((a, b) => a.cost - b.cost)[0];
    return { label, config: variant, outcomes: outcomes.map(({ policy, cost, unsafeOperatingH, rejectedRepairCount }) => ({ policy, cost, unsafeOperatingH, rejectedRepairCount })), minimumCostPolicy: cheapest.policy };
  });
  return { version: 'wt-policy-comparison-1.0', modelVersion: rulModel.version, modelHashes: { ...rulModel.modelHashes }, sourceHashes: { ...rulModel.sourceHashes }, config: { ...config }, wind: Array.from({ length: config.horizon + 1 }, (_, i) => experimentWind(config, i)), results, sensitivity,
    scope: 'Deterministic simulation; not measured savings. Same calendar horizon/wind/initial crack, action-dependent damage. Advisory inspection/prepositioning not executed. No discounting or failure probability model.',
    accounting: 'Direct/logistics charged once at start; downtime/contract pro rata only as incurred; repair at completion only. One terminal heuristic risk allowance, not repeated per service. All policies force corrective at 80 mm. Unsafe operating h: crack >=60 mm or lower RUL <240 pseudo-h. Baseline monitoring costs omitted equally.' };
}
export type Comparison = ReturnType<typeof runComparison>;
