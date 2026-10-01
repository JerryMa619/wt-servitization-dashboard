export type ServiceState = 'Nominal' | 'Watch' | 'Degraded' | 'MaintenanceDue' | 'Critical' | 'OutOfContract';
export const modelMetadata = {
  version: 'wt-demo-2.0',
  scope: 'Uncalibrated scenario model; not a measured failure probability',
  basis: 'Chapter 5 replay context + dashboard engineering assumptions',
  cutInMs: 3,
  maxRpm: 1200,
  maxPowerW: 800,
  monitorStepH: 1,
  freshnessLimitMs: 5000
};
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const severity: ServiceState[] = ['Nominal', 'Watch', 'Degraded', 'MaintenanceDue', 'Critical', 'OutOfContract'];

export function rulState(p10: number): ServiceState {
  return p10 < 120 ? 'Critical' : p10 < 240 ? 'MaintenanceDue' : p10 < 430 ? 'Degraded' : p10 < 670 ? 'Watch' : 'Nominal';
}

export function conditionState(point: { rulP10: number; crackMm?: number; vibrationRms: number; kurtosis: number }): ServiceState {
  const crack = point.crackMm ?? 0;
  const damage: ServiceState = crack >= 80 ? 'OutOfContract' : crack >= 45 ? 'MaintenanceDue' : crack >= 30 ? 'Degraded' : crack >= 20 ? 'Watch' : 'Nominal';
  const signal: ServiceState = point.vibrationRms > 0.16 || point.kurtosis > 6.2 ? 'MaintenanceDue' : point.vibrationRms > 0.12 || point.kurtosis > 4.8 ? 'Degraded' : point.vibrationRms > 0.085 || point.kurtosis > 3.7 ? 'Watch' : 'Nominal';
  return [damage, signal, rulState(point.rulP10)].reduce((highest, state) => severity.indexOf(state) > severity.indexOf(highest) ? state : highest, 'Nominal');
}

export function operatingOutput(windSpeed: number, hold = false) {
  const speed = clamp(windSpeed, 0, 40);
  if (hold || speed < modelMetadata.cutInMs) return { rpm: 0, power: 0 };
  return { rpm: Math.round(clamp(speed * 78, 0, modelMetadata.maxRpm)), power: Math.round(clamp(Math.pow(speed, 2.12) * 8.9, 0, modelMetadata.maxPowerW)) };
}

export function conditionPrediction(windSpeed: number, crackMm: number) {
  const speed = clamp(windSpeed, 0, 40);
  const damage = clamp(crackMm / 80, 0, 1);
  const loadPenalty = Math.round(Math.max(0, speed - 7) * 18 + Math.max(0, speed - 11) * 42);
  const rulP50 = Math.round(clamp(1000 * (1 - Math.pow(damage, 1.16)) - loadPenalty * 0.7, 0, 1000));
  const rulSpread = Math.max(50, Math.round(128 - damage * 58));
  return {
    vibrationRms: Number(clamp(0.038 + speed * 0.004 + damage * 0.112 + Math.max(0, speed - 9) * 0.006, 0.028, 0.32).toFixed(4)),
    kurtosis: Number(clamp(2.65 + damage * 4.2 + Math.max(0, speed - 8) * 0.18, 2.5, 12).toFixed(2)),
    modalF1: Number(clamp(27.55 - damage * 3.8 - Math.max(0, speed - 10) * 0.07, 18, 32).toFixed(2)),
    rulP10: Math.max(0, Math.round(rulP50 - rulSpread - loadPenalty * 0.3)), rulP50,
    rulP90: Math.round(rulP50 + rulSpread * 0.82), rulSpread
  };
}

export const inputBounds: Record<string, { min: number; max: number; label: string }> = {
  lat: { min: -90, max: 90, label: 'GPS latitude' }, lon: { min: -180, max: 180, label: 'GPS longitude' },
  windSpeed: { min: 0, max: 40, label: 'Wind speed' }, windDirection: { min: 0, max: 360, label: 'Wind direction' },
  rpm: { min: 0, max: 1200, label: 'Rotor RPM' }, power: { min: 0, max: 800, label: 'Power W' },
  vibrationRms: { min: 0, max: 1, label: 'Vibration RMS' }, kurtosis: { min: 0, max: 30, label: 'Kurtosis' },
  modalF1: { min: 0, max: 80, label: 'Modal f1' }, crackMm: { min: 0, max: 80, label: 'Crack length' },
  rulP10: { min: 0, max: 1200, label: 'RUL P10' }, rulP50: { min: 0, max: 1200, label: 'RUL P50' }, rulP90: { min: 0, max: 1200, label: 'RUL P90' }
};
export function inputRangeErrors(form: Record<string, number>) {
  return Object.entries(inputBounds).filter(([key, bounds]) => !Number.isFinite(form[key]) || form[key] < bounds.min || form[key] > bounds.max).map(([, bounds]) => `${bounds.label} must be between ${bounds.min} and ${bounds.max}.`);
}

export function readingFreshness(reading: { source?: string; observedAt?: string; receivedAt?: string }, now = Date.now()) {
  if (reading.source === 'manual-input') return { status: 'context', value: 'Held scenario', note: 'Manual input; not live telemetry' };
  if (!['auto-simulation', 'auto-service', 'service-action'].includes(reading.source ?? '')) return { status: 'context', value: 'Replay reference', note: 'Source time is not a live observation time' };
  const observed = Date.parse(reading.observedAt ?? '');
  const received = Date.parse(reading.receivedAt ?? '');
  if (!Number.isFinite(observed) || !Number.isFinite(received) || observed > now + 1000 || received > now + 1000) return { status: 'warn', value: 'Timestamp unavailable', note: 'Freshness cannot be verified' };
  const age = Math.max(0, now - Math.min(observed, received));
  return { status: age <= modelMetadata.freshnessLimitMs ? 'pass' : 'warn', value: `${(age / 1000).toFixed(1)} s age`, note: `Simulation clock; stale after ${modelMetadata.freshnessLimitMs / 1000} s` };
}

export type SimulationStats = { totalDowntimeH: number; observationHours: number; completedServices: number; lastAction?: string; lastCompletedAt?: string };
export const emptyStats = (): SimulationStats => ({ totalDowntimeH: 0, observationHours: 0, completedServices: 0 });
export function advanceStats(stats: SimulationStats, elapsedH: number, downtimeH: number, completed?: { action: string; at: string }): SimulationStats {
  return { ...stats, observationHours: Number((stats.observationHours + elapsedH).toFixed(6)), totalDowntimeH: Number((stats.totalDowntimeH + downtimeH).toFixed(6)), completedServices: stats.completedServices + (completed ? 1 : 0), ...(completed ? { lastAction: completed.action, lastCompletedAt: completed.at } : {}) };
}
export function simulationAvailability(stats: SimulationStats) {
  return stats.observationHours > 0 ? clamp(1 - stats.totalDowntimeH / stats.observationHours, 0, 1) : null;
}
