import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { chapter5ReplayVectors, rulModel, scenarioFeatures } from '../src/model/xgboost.ts';
import { axes, featureScope, readWaveformBundle, selectReference, vibrationFeatures, vibrationTrendOption, waveformFrame, waveformOption } from '../src/vibration/model.ts';

const source = readFileSync(new URL('../public/data/vibration-waveforms.json', import.meta.url));
const bundle = readWaveformBundle(JSON.parse(source));
const audit = JSON.parse(readFileSync(new URL('../models/vibration/waveform-manifest.json', import.meta.url), 'utf8'));
const latest = { t: '10:00', rulFeatureVector: chapter5ReplayVectors[0], vibrationRms: .04, kurtosis: 2.7, rulEvidence: { featureSource: 'chapter5-window' } };

test('RMS and kurtosis read all three named features without changing the Z-based policy input', () => {
  const result = vibrationFeatures(latest);
  for (const [i, prefix] of ['ax', 'ay', 'az'].entries()) {
    assert.equal(result.rms[i], latest.rulFeatureVector[rulModel.featureNames.indexOf(`${prefix}_rms`)]);
    assert.equal(result.kurtosis[i], latest.rulFeatureVector[rulModel.featureNames.indexOf(`${prefix}_kurtosis`)]);
  }
  assert.equal(latest.vibrationRms, .04);
  const manual = scenarioFeatures(8, 40, { vibrationRms: .2, kurtosis: 8 });
  assert.equal(vibrationFeatures({ t: 'held', rulFeatureVector: manual }).rms[2], .2);
});
test('legacy records leave unknown axes missing instead of manufacturing zero signals', () => {
  assert.deepEqual(vibrationFeatures({ t: 'old', vibrationRms: .05, kurtosis: 3 }), { rms: [null, null, .05], kurtosis: [null, null, 3] });
  assert.deepEqual(vibrationFeatures({ t: 'old' }), { rms: [null, null, null], kurtosis: [null, null, null] });
  assert.match(featureScope({ t: 'old' }), /missing axes omitted/);
  assert.match(featureScope({ ...latest, rulEvidence: { featureSource: 'reference-assisted' } }), /not measured/);
});
test('separate charts retain exact samples, units, zero RMS baseline and unsmoothed gaps', () => {
  const history = [latest, { ...latest, t: '10:01', rulFeatureVector: chapter5ReplayVectors[1] }];
  const rms = vibrationTrendOption(history, 'rms'), kurt = vibrationTrendOption(history, 'kurtosis');
  assert.equal(rms.yAxis.name, 'RMS (g)'); assert.equal(rms.yAxis.min, 0);
  assert.equal(kurt.yAxis.name, 'Pearson k'); assert.equal(kurt.yAxis.scale, true);
  for (const [i, axis] of axes.entries()) {
    assert.equal(rms.series[i].name, axis); assert.equal(kurt.series[i].name, axis);
    assert.deepEqual(rms.series[i].data, history.map((p) => vibrationFeatures(p).rms[i]));
    assert.deepEqual(kurt.series[i].data, history.map((p) => vibrationFeatures(p).kurtosis[i]));
    assert.equal(rms.series[i].smooth, false); assert.equal(rms.series[i].connectNulls, false);
  }
  assert.equal(new Set(rms.series.map((s) => s.lineStyle.type)).size, 3);
});
test('waveform archive has traceable excerpts and discloses missing/simulated source data', () => {
  assert.equal(createHash('sha256').update(source).digest('hex'), audit.artifactSha256);
  assert.equal(bundle.records.length, 21);
  assert.equal(audit.metadataAcquisitions, audit.availableAcquisitions + audit.missingAcquisitions);
  assert.equal(audit.missingAcquisitions, 105);
  assert.match(bundle.manifest.scope, /simulated reference, not live/);
  for (const record of bundle.records) {
    const meta = audit.records.find((r) => r.id === record.id);
    assert.ok(meta); assert.deepEqual(meta.stats, record.stats);
    assert.match(record.sourceSha256, /^[0-9a-f]{64}$/);
    assert.equal(record.samples.length, 4000); assert.equal(record.fullSampleCount, 60000);
  }
});
test('reference selection uses nearest damage then wind, not an assertion of current measured waveform', () => {
  const reference = selectReference(bundle.records, 32, 6);
  assert.equal(reference.state, 'C3'); assert.equal(reference.windBin, 'mid');
  assert.equal(selectReference(bundle.records, 80, 3.5).state, 'C6');
  assert.equal(selectReference([], 0, 4), null);
});
test('waveform playback preserves archived acceleration without scaling, noise or joined wraparound', () => {
  const reference = bundle.records[0];
  for (const [i, axis] of axes.entries()) {
    const frame = waveformFrame(reference, axis, 200);
    assert.equal(frame.length, 500); assert.deepEqual(frame[0], [.1, reference.samples[200][i]]);
    assert.deepEqual(frame.at(-1), [699 / 2000, reference.samples[699][i]]);
    const option = waveformOption(reference, axis, 200);
    assert.deepEqual(option.series[0].data, frame); assert.equal(option.series[0].smooth, false);
    assert.equal(option.yAxis.min, -option.yAxis.max);
    assert.equal(option.tooltip.valueFormatter([.1, .012345]), '0.012345 g');
  }
  assert.deepEqual(waveformFrame(reference, 'X', -10)[0], [0, reference.samples[0][0]]);
  assert.equal(waveformFrame(reference, 'X', 99999).at(-1)[0], 3999 / 2000);
  assert.deepEqual(waveformOption(null, 'X', 0).series[0].data, []);
});
test('malformed waveform archives fail closed', () => {
  assert.throws(() => readWaveformBundle({}));
  const bad = structuredClone(bundle); bad.records[0].samples[0][0] = NaN;
  assert.throws(() => readWaveformBundle(bad));
  const missing = structuredClone(bundle); missing.records.pop();
  assert.throws(() => readWaveformBundle(missing));
});
