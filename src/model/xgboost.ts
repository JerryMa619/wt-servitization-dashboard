import artifact from '../data/chapter5Xgboost.ts';

export const rulModel = artifact.manifest;
export const chapter5ReplayVectors = artifact.replayVectors;
export type RulFeatureSource = 'chapter5-window' | 'reference-assisted' | 'imported-window' | 'manual-override';
export type RulEvidence = {
  modelVersion: string;
  featureSource: RulFeatureSource;
  rawQuantiles: number[];
  quantileAdjusted: boolean;
  outsideTraining: string[];
  intervalCalibration?: { radius: number; nominalCoverage: number; scope: 'source-window' | 'reference-only' | 'out-of-domain' };
};
type Tree = { left_children: number[]; right_children: number[]; split_indices: number[]; split_conditions: number[]; default_left: number[] };
type Ensemble = { baseScore: number; trees: Tree[] };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function predictRawQuantiles(values: number[]) {
  if (values.length !== rulModel.featureNames.length) throw new Error(`XGBoost requires ${rulModel.featureNames.length} ordered features.`);
  const input = values.map(Math.fround);
  return ['p10', 'p50', 'p90'].map((key) => {
    const ensemble: Ensemble = artifact.models[key as keyof typeof artifact.models];
    let prediction = Math.fround(ensemble.baseScore);
    for (const tree of ensemble.trees) {
      let node = 0;
      while (tree.left_children[node] !== -1) {
        const value = input[tree.split_indices[node]];
        const left = Number.isNaN(value) ? !!tree.default_left[node] : value < Math.fround(tree.split_conditions[node]);
        node = left ? tree.left_children[node] : tree.right_children[node];
      }
      prediction = Math.fround(prediction + Math.fround(tree.split_conditions[node]));
    }
    return prediction;
  });
}

export function predictRul(values: number[], featureSource: RulFeatureSource) {
  if (values.length !== rulModel.featureNames.length || !values.every(Number.isFinite)) throw new Error('A complete, finite Chapter 5 feature window is required.');
  const raw = predictRawQuantiles(values);
  // Keep raw percentiles separate from the calibrated envelope; round tails outward.
  const clipped = raw.map((v) => clamp(v, 0, 1000));
  const radius = rulModel.calibration.radius;
  const rulP50 = Math.round(clipped[1]);
  const rulP10 = Math.floor(Math.max(0, Math.min(...clipped) - radius));
  const rulP90 = Math.ceil(Math.min(1000, Math.max(...clipped) + radius));
  const outsideTraining = rulModel.featureNames.filter((_, i) => Math.fround(values[i]) < Math.fround(rulModel.featureRanges[i].min) || Math.fround(values[i]) > Math.fround(rulModel.featureRanges[i].max));
  const rulEvidence: RulEvidence = { modelVersion: rulModel.version, featureSource, rawQuantiles: raw, quantileAdjusted: raw[0] > raw[1] || raw[1] > raw[2] || raw.some((v) => v < 0 || v > 1000), outsideTraining,
    intervalCalibration: { radius, nominalCoverage: rulModel.calibration.nominalCoverage, scope: outsideTraining.length ? 'out-of-domain' : featureSource === 'reference-assisted' ? 'reference-only' : 'source-window' } };
  return { rulP10, rulP50, rulP90, rulSpread: rulP50 - rulP10, rulUpperSpread: rulP90 - rulP50, rulEvidence };
}

function interpolate(points: { coordinate: number; values: number[] }[], coordinate: number): number[] {
  const sorted = [...points].sort((a, b) => a.coordinate - b.coordinate);
  const lower = [...sorted].reverse().find((p) => p.coordinate <= coordinate) ?? sorted[0];
  const upper = sorted.find((p) => p.coordinate >= coordinate) ?? sorted[sorted.length - 1];
  const weight = upper.coordinate === lower.coordinate ? 0 : clamp((coordinate - lower.coordinate) / (upper.coordinate - lower.coordinate), 0, 1);
  return lower.values.map((value, i) => value + weight * (upper.values[i] - value));
}

export function referenceFeatures(windSpeed: number, crackMm: number) {
  const cracks = [...new Set(artifact.references.map((p) => p.crackMm))];
  const values = interpolate(cracks.map((crack) => ({ coordinate: crack, values: interpolate(artifact.references.filter((p) => p.crackMm === crack).map((p) => ({ coordinate: p.windSpeed, values: p.values })), windSpeed) })), crackMm);
  values[rulModel.featureNames.indexOf('wind_mean')] = windSpeed;
  return values;
}

export type FeatureOverrides = { vibrationRms?: number; kurtosis?: number; modalF1?: number; rpm?: number };
export function scenarioFeatures(windSpeed: number, crackMm: number, overrides: FeatureOverrides = {}) {
  const values = referenceFeatures(windSpeed, crackMm);
  const index = (name: string) => rulModel.featureNames.indexOf(name);
  const get = (name: string) => values[index(name)];
  const set = (name: string, value: number) => { values[index(name)] = value; };
  if (overrides.vibrationRms != null) {
    const ratio = overrides.vibrationRms / Math.max(get('az_rms'), 1e-9);
    for (const name of ['ax_rms', 'ay_rms', 'az_rms', 'ax_peak', 'ay_peak', 'az_peak']) set(name, get(name) * ratio);
  }
  if (overrides.kurtosis != null) for (const axis of ['ax', 'ay', 'az']) set(`${axis}_kurtosis`, overrides.kurtosis);
  if (overrides.modalF1 != null) set('modal_f1', overrides.modalF1);
  if (overrides.rpm != null) set('rpm', overrides.rpm);
  set('ti_proxy', get('az_rms') / Math.max(get('ax_rms'), 1e-9));
  set('rms_ratio_ax_ay', get('ax_rms') / Math.max(get('ay_rms'), 1e-9));
  set('ax_pk2rms', get('ax_peak') / Math.max(get('ax_rms'), 1e-9));
  set('ax_kurt_rms', get('ax_kurtosis') * get('ax_rms'));
  return values;
}

export function readFeatureWindow(raw: string) {
  if (raw.length > 100_000) throw new Error('Feature window exceeds 100 KB.');
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Expected a JSON object with named Chapter 5 features.');
  const features = 'features' in parsed ? (parsed as { features: unknown }).features : parsed;
  if (!features || typeof features !== 'object' || Array.isArray(features)) throw new Error('Expected a named feature object.');
  const record = features as Record<string, unknown>;
  const missing = rulModel.featureNames.filter((name) => typeof record[name] !== 'number' || !Number.isFinite(record[name]));
  if (missing.length) throw new Error(`Missing or nonnumeric features: ${missing.join(', ')}`);
  return rulModel.featureNames.map((name) => record[name] as number);
}

export function featureMeasurements(values: number[]) {
  const get = (name: string) => values[rulModel.featureNames.indexOf(name)];
  return { windSpeed: get('wind_mean'), rpm: get('rpm'), vibrationRms: get('az_rms'), kurtosis: get('az_kurtosis'), modalF1: get('modal_f1') };
}

export function rulDescription(reading: { modelVersion?: string; rulEvidence?: RulEvidence }) {
  if (reading.rulEvidence?.featureSource === 'manual-override') return 'Manual RUL assumption / not XGBoost output';
  if (reading.modelVersion === rulModel.version) return reading.rulEvidence?.featureSource === 'reference-assisted' ? 'XGBoost / reference-assisted scenario' : 'XGBoost / full feature window';
  return reading.modelVersion ? `${reading.modelVersion} / legacy bounds` : 'Chapter 5 legacy replay bounds';
}

export function rulUncertaintyDescription(reading: { modelVersion?: string; rulEvidence?: RulEvidence }) {
  if (reading.rulEvidence?.featureSource === 'manual-override') return 'Manual RUL assumption / not model uncertainty';
  if (reading.modelVersion !== rulModel.version) return 'Historical bounds retained / not calibrated by the active model';
  const scope = reading.rulEvidence?.intervalCalibration?.scope;
  return `P10/P90-based window-calibrated envelope / nominal 80%; no field validation${scope === 'reference-only' ? '; reference scenario, coverage not validated' : scope === 'out-of-domain' ? '; outside training range, coverage not validated' : ''}`;
}
