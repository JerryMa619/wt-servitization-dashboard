import { rulModel } from '../model/xgboost.ts';

export const axes = ['X', 'Y', 'Z'] as const;
export type Axis = typeof axes[number];
const colors = ['#48c9b0', '#e7b557', '#df85ad'];
const styles = ['solid', 'dashed', 'dotted'];
type Reading = { t: string; rulFeatureVector?: number[]; vibrationRms?: number; axialRms?: number; kurtosis?: number; rulEvidence?: { featureSource: string } };
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export function vibrationFeatures(reading: Reading) {
  const get = (name: string, fallback?: number) => {
    const value = reading.rulFeatureVector?.[rulModel.featureNames.indexOf(name)];
    return finite(value) ? value : finite(fallback) ? fallback : null;
  };
  return { rms: [get('ax_rms', reading.axialRms), get('ay_rms'), get('az_rms', reading.vibrationRms)],
           kurtosis: [get('ax_kurtosis'), get('ay_kurtosis'), get('az_kurtosis', reading.kurtosis)] };
}

export function featureScope(reading: Reading) {
  if (!reading.rulFeatureVector) return 'Historical feature coverage; missing axes omitted';
  return reading.rulEvidence?.featureSource === 'reference-assisted' || reading.rulEvidence?.featureSource === 'manual-override'
    ? 'Reference-assisted feature windows / not measured'
    : 'Full feature windows / not live sensor telemetry';
}

const scaffolding = {
  backgroundColor: 'transparent',
  animation: false,
  tooltip: { trigger: 'axis', confine: true, className: 'vibration-tooltip', backgroundColor: 'rgba(9,14,13,.96)', borderColor: 'rgba(100,226,189,.32)', textStyle: { color: '#d9e7e3' } },
  legend: { top: 0, textStyle: { color: '#b8c9c3' } },
  grid: { left: 58, right: 22, top: 46, bottom: 40 },
};
const axisStyle = {
  axisLabel: { color: '#a6bbb3', fontSize: 11 },
  axisLine: { lineStyle: { color: 'rgba(128,169,158,.34)' } },
  splitLine: { lineStyle: { color: 'rgba(128,169,158,.14)' } },
  nameTextStyle: { color: '#a6bbb3', fontSize: 11 },
};

export function vibrationTrendOption(history: Reading[], kind: 'rms' | 'kurtosis') {
  const values = history.map(vibrationFeatures);
  return {
    ...scaffolding,
    tooltip: { ...scaffolding.tooltip, valueFormatter: (value: number | null) => finite(value) ? `${value.toFixed(kind === 'rms' ? 4 : 3)}${kind === 'rms' ? ' g' : ''}` : 'Unavailable' },
    xAxis: { ...axisStyle, type: 'category', data: history.map((p) => p.t), boundaryGap: false, axisLabel: { ...axisStyle.axisLabel, hideOverlap: true } },
    yAxis: { ...axisStyle, type: 'value', name: kind === 'rms' ? 'RMS (g)' : 'Pearson k', ...(kind === 'rms' ? { min: 0 } : { scale: true }), axisLabel: { ...axisStyle.axisLabel, formatter: (v: number) => v.toFixed(kind === 'rms' ? 3 : 2) } },
    series: axes.map((axis, i) => ({ name: axis, type: 'line', smooth: false, connectNulls: false, showSymbol: history.length < 2, symbolSize: 5,
      data: values.map((p) => p[kind][i]), itemStyle: { color: colors[i] }, lineStyle: { color: colors[i], width: 2, type: styles[i] } })),
  };
}

export type Waveform = { id: string; state: string; crackMm: number; windBin: string; windSpeed: number; sampleRateHz: number; fullSampleCount: number; excerptSampleCount: number; sourceSha256: string; stats: Record<string, { rms: number; kurtosis: number }>; samples: number[][] };
export type WaveformBundle = { manifest: { version: string; scope: string; units: string; referenceAcquisitions: number }; records: Waveform[] };

export function readWaveformBundle(raw: unknown): WaveformBundle {
  const bundle = raw as WaveformBundle;
  if (!bundle?.manifest || bundle.manifest.version !== 'ch5-vibration-reference-1.0' || bundle.manifest.units !== 'g' || !Array.isArray(bundle.records) || bundle.records.length !== 21) throw new Error('Invalid vibration reference archive');
  for (const record of bundle.records) {
    if (typeof record.id !== 'string' || !/^vib_C[0-6]_(low|mid|high)_\d+\.csv$/.test(record.id) || !/^C[0-6]$/.test(record.state) || !['low', 'mid', 'high'].includes(record.windBin) || !finite(record.crackMm) || !finite(record.windSpeed) || record.sampleRateHz !== 2000 || record.excerptSampleCount !== 4000 || !Number.isInteger(record.fullSampleCount) || record.fullSampleCount < record.excerptSampleCount || !Array.isArray(record.samples) || record.samples.length !== record.excerptSampleCount || record.samples.some((row) => !Array.isArray(row) || row.length !== 3 || !row.every(finite))) throw new Error('Invalid vibration reference samples');
  }
  return bundle;
}

export function selectReference(records: Waveform[], crackMm: number, windSpeed: number) {
  const closestCrack = Math.min(...records.map((r) => Math.abs(r.crackMm - crackMm)));
  return records.filter((r) => Math.abs(r.crackMm - crackMm) === closestCrack)
    .reduce<Waveform | null>((best, r) => !best || Math.abs(r.windSpeed - windSpeed) < Math.abs(best.windSpeed - windSpeed) ? r : best, null);
}

export function waveformFrame(record: Waveform, axis: Axis, offset: number) {
  const count = record.sampleRateHz / 4;
  const start = Math.max(0, Math.min(Math.floor(offset), record.samples.length - count));
  const index = axes.indexOf(axis);
  return record.samples.slice(start, start + count).map((row, i) => [(start + i) / record.sampleRateHz, row[index]]);
}

export function waveformOption(record: Waveform | null, axis: Axis, offset: number) {
  const index = axes.indexOf(axis);
  const extent = record ? Math.ceil(Math.max(...record.samples.map((row) => Math.abs(row[index]))) * 1.1 * 1000) / 1000 : 1;
  return {
    ...scaffolding,
    legend: { show: false },
    grid: { ...scaffolding.grid, top: 30, bottom: 44 },
    tooltip: { ...scaffolding.tooltip, valueFormatter: (value: number | number[]) => {
      const acceleration = Array.isArray(value) ? value[value.length - 1] : value;
      return finite(acceleration) ? `${acceleration.toFixed(6)} g` : 'Unavailable';
    } },
    xAxis: { ...axisStyle, type: 'value', name: 'Time (s)', nameLocation: 'middle', nameGap: 28, scale: true, axisLabel: { ...axisStyle.axisLabel, formatter: (v: number) => v.toFixed(3), hideOverlap: true } },
    yAxis: { ...axisStyle, type: 'value', name: `${axis} (g)`, min: -extent, max: extent, axisLabel: { ...axisStyle.axisLabel, formatter: (v: number) => v.toFixed(2) } },
    series: [{ name: `${axis} acceleration`, type: 'line', showSymbol: false, smooth: false, data: record ? waveformFrame(record, axis, offset) : [], lineStyle: { width: 1.5, color: colors[index] } }],
  };
}
