import { conditionPrediction, type ServiceState } from './operating.ts';
import type { OntologyReading } from '../ontology/model.ts';

export type MaintenanceActionKey = 'condition-inspection' | 'preactive-maintenance' | 'predictive-maintenance' | 'proactive-maintenance' | 'active-maintenance' | 'corrective-maintenance' | 'spare-prepositioning';
export type ServiceCostEstimate = { action: MaintenanceActionKey; totalCost: number; directCost: number; downtimeCost: number; logisticsCost: number; contractCost: number; residualRiskCost: number; residualRiskScore: number; residualCrackMm: number; residualRulP10: number };
type HistoryPoint = OntologyReading & { power: number };
export type CostAssumptions = { downtimeScale?: number; consequenceScale?: number; repairScale?: number };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const maintenanceActions: Record<
  MaintenanceActionKey,
  { label: string; description: string; defaultDowntimeH: number; crackReduction: number }
> = {
  "condition-inspection": {
    label: "Condition-based inspection",
    description: "Inspect the blade, verify crack state and keep the asset under watch.",
    defaultDowntimeH: 2,
    crackReduction: 0
  },
  "preactive-maintenance": {
    label: "Preactive maintenance",
    description: "Early service before the formal threshold is crossed.",
    defaultDowntimeH: 4,
    crackReduction: 0.28
  },
  "predictive-maintenance": {
    label: "Predictive maintenance",
    description: "RUL-triggered planned blade service using the DT prediction.",
    defaultDowntimeH: 8,
    crackReduction: 0.55
  },
  "proactive-maintenance": {
    label: "Proactive maintenance",
    description: "Prevent recurrence through planned repair and operating-policy update.",
    defaultDowntimeH: 10,
    crackReduction: 0.62
  },
  "active-maintenance": {
    label: "Active maintenance",
    description: "Immediate intervention while degradation is active.",
    defaultDowntimeH: 12,
    crackReduction: 0.72
  },
  "corrective-maintenance": {
    label: "Corrective maintenance",
    description: "Repair or replace the blade after a high-risk or failed condition.",
    defaultDowntimeH: 24,
    crackReduction: 1
  },
  "spare-prepositioning": {
    label: "Spare-part pre-positioning",
    description: "Reserve blade kit and logistics slot; no immediate physical repair.",
    defaultDowntimeH: 1,
    crackReduction: 0
  }
};

export const serviceEconomics: Record<
  MaintenanceActionKey,
  { directCost: number; logisticsCost: number; planningCredit: number; riskMultiplier: number }
> = {
  "condition-inspection": { directCost: 180, logisticsCost: 40, planningCredit: 0, riskMultiplier: 0.92 },
  "spare-prepositioning": { directCost: 420, logisticsCost: 280, planningCredit: 220, riskMultiplier: 0.78 },
  "preactive-maintenance": { directCost: 1250, logisticsCost: 320, planningCredit: 130, riskMultiplier: 0.58 },
  "predictive-maintenance": { directCost: 2300, logisticsCost: 420, planningCredit: 280, riskMultiplier: 0.35 },
  "proactive-maintenance": { directCost: 2650, logisticsCost: 520, planningCredit: 340, riskMultiplier: 0.3 },
  "active-maintenance": { directCost: 3850, logisticsCost: 740, planningCredit: 120, riskMultiplier: 0.22 },
  "corrective-maintenance": { directCost: 7800, logisticsCost: 1350, planningCredit: 0, riskMultiplier: 0.08 }
};

export const tcsParameters = {
  downtimeCostPerHour: 95,
  availabilityPenaltyPerHour: 42,
  energyValuePerKwh: 0.28,
  unplannedFailureConsequence: 9800
};

export function serviceDecisionByTcs(point: HistoryPoint, serviceState: ServiceState, assumptions: CostAssumptions = {}) {
  const candidates = serviceCandidatesForState(point, serviceState);
  const estimates = candidates
    .map((action) => estimateTcs(point, action, undefined, assumptions))
    .sort((a, b) => a.totalCost - b.totalCost);
  const riskFiltered = estimates.filter((estimate) => isRiskAcceptableAfterAction(point, estimate, serviceState));

  return riskFiltered[0] ?? estimates[0];
}

export function serviceCandidatesForState(point: HistoryPoint, serviceState: ServiceState): MaintenanceActionKey[] {
  const crackMm = point.crackMm ?? 0;

  if (serviceState === "OutOfContract" || crackMm >= 80) return ["corrective-maintenance", "active-maintenance"];
  if (serviceState === "Critical" || crackMm >= 60 || point.rulP10 < 240) {
    return ["active-maintenance", "corrective-maintenance", "predictive-maintenance"];
  }
  if (crackMm >= 45 || point.rulP10 < 360) {
    return ["predictive-maintenance", "proactive-maintenance", "active-maintenance", "spare-prepositioning"];
  }
  if (crackMm >= 30 || serviceState === "Degraded") {
    return ["spare-prepositioning", "preactive-maintenance", "predictive-maintenance", "condition-inspection"];
  }
  if (crackMm >= 20 || serviceState === "Watch") {
    return ["condition-inspection", "spare-prepositioning", "preactive-maintenance"];
  }
  return ["condition-inspection", "spare-prepositioning"];
}

export function isRiskAcceptableAfterAction(point: HistoryPoint, estimate: ServiceCostEstimate, serviceState: ServiceState) {
  const crackMm = point.crackMm ?? 0;

  if (serviceState === "OutOfContract" || crackMm >= 80) return estimate.residualCrackMm < 20 && estimate.residualRiskScore < 0.24;
  if (serviceState === "Critical" || crackMm >= 60 || point.rulP10 < 240) return estimate.residualCrackMm < 45 && estimate.residualRiskScore < 0.34;
  if (crackMm >= 45 || point.rulP10 < 360) return estimate.residualCrackMm < 35 && estimate.residualRiskScore < 0.42;
  if (crackMm >= 30 || serviceState === "Degraded") return estimate.residualRiskScore < 0.56;
  return estimate.residualRiskScore < 0.72;
}

export function estimateTcs(point: HistoryPoint, action: MaintenanceActionKey, downtimeOverride?: number, assumptions: CostAssumptions = {}): ServiceCostEstimate {
  const actionConfig = maintenanceActions[action];
  const economics = serviceEconomics[action];
  const downtimeH = downtimeOverride ?? actionConfig.defaultDowntimeH;
  const crackBefore = point.crackMm ?? 0;
  const residualCrackMm = Number(clamp(crackBefore * (1 - clamp(actionConfig.crackReduction * (assumptions.repairScale ?? 1), 0, 1)), 0, 80).toFixed(1));
  const residualRulP10 = residualCrackMm === crackBefore ? point.rulP10 : conditionPrediction(point.windSpeed, residualCrackMm).rulP10;
  const residualRiskScore =
    residualRiskAfterAction(point, residualCrackMm, residualRulP10) * economics.riskMultiplier;
  const downtimeCost = downtimeH * tcsParameters.downtimeCostPerHour * (assumptions.downtimeScale ?? 1) + (point.power / 1000) * downtimeH * tcsParameters.energyValuePerKwh;
  const contractCost = downtimeH * tcsParameters.availabilityPenaltyPerHour * (point.rulP10 < 360 ? 1.25 : 1);
  const residualRiskCost = Math.pow(residualRiskScore, 2) * tcsParameters.unplannedFailureConsequence * (assumptions.consequenceScale ?? 1);
  const totalCost = Math.max(
    0,
    economics.directCost + economics.logisticsCost + downtimeCost + contractCost + residualRiskCost - economics.planningCredit
  );

  return {
    action,
    totalCost: Math.round(totalCost),
    directCost: Math.round(economics.directCost),
    downtimeCost: Math.round(downtimeCost),
    logisticsCost: Math.round(Math.max(0, economics.logisticsCost - economics.planningCredit)),
    contractCost: Math.round(contractCost),
    residualRiskCost: Math.round(residualRiskCost),
    residualRiskScore: Number(residualRiskScore.toFixed(3)),
    residualCrackMm,
    residualRulP10
  };
}

export function residualRiskAfterAction(point: HistoryPoint, residualCrackMm: number, residualRulP10: number) {
  const crackRisk = clamp(residualCrackMm / 80, 0, 1) * 0.48;
  const rulRisk = clamp(1 - residualRulP10 / 900, 0, 1) * 0.32;
  const vibrationRisk = clamp((point.vibrationRms - 0.04) / 0.18, 0, 1) * 0.13;
  const loadRisk = clamp((point.windSpeed - 7) / 7, 0, 1) * 0.07;
  return clamp(crackRisk + rulRisk + vibrationRisk + loadRisk, 0.02, 0.98);
}
