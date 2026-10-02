import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { chapter5ReplayVectors, featureMeasurements, predictRawQuantiles, predictRul, readFeatureWindow, referenceFeatures, rulDescription, rulModel, scenarioFeatures } from '../src/model/xgboost.ts';

const fixture = JSON.parse(readFileSync(new URL('../models/chapter5/python-parity.json', import.meta.url), 'utf8'));
test('browser tree evaluation matches Python XGBoost on all windows and missing-value routes', () => {
  let maxError = 0;
  for (const [i, vector] of fixture.vectors.entries()) {
    const actual = predictRawQuantiles(vector.map((v) => v == null ? NaN : v));
    for (const [q, key] of ['p10', 'p50', 'p90'].entries()) {
      const error = Math.abs(actual[q] - fixture.predictions[key][i]);
      assert.ok(error <= fixture.tolerance, `${i} ${key}: ${error}`); maxError = Math.max(maxError, error);
    }
  }
  writeFileSync(new URL('../models/chapter5/browser-parity.json', import.meta.url), JSON.stringify({ vectors: fixture.vectors.length, quantiles: 3, maxAbsoluteError: maxError, tolerance: fixture.tolerance }, null, 2) + '\n');
});
test('original configuration, source artifacts and label exclusions are preserved', () => {
  assert.equal(rulModel.featureNames.length, 31);
  assert.deepEqual(rulModel.parameters, { n_estimators: 300, max_depth: 6, learning_rate: .05, objective: 'reg:quantileerror', random_state: 42, verbosity: 0 });
  assert.ok(!('base_score' in rulModel.parameters));
  for (const label of ['state', 'crack_mm', 'wind_bin', 'rul_h']) assert.ok(!rulModel.featureNames.includes(label));
  for (const [name, hash] of Object.entries(rulModel.modelHashes)) assert.equal(createHash('sha256').update(readFileSync(new URL(`../models/chapter5/${name}.json`, import.meta.url))).digest('hex'), hash);
  assert.equal(createHash('sha256').update(readFileSync(new URL('../models/chapter5/features.csv', import.meta.url))).digest('hex'), rulModel.sourceHashes['features.csv']);
  assert.equal(createHash('sha256').update(readFileSync(new URL('../models/chapter5/source-run-pipeline.py', import.meta.url))).digest('hex'), rulModel.sourceHashes['run_pipeline.py']);
  assert.equal(chapter5ReplayVectors.length, 315);
  const dashboard = JSON.parse(readFileSync(new URL('../src/data/dashboardData.json', import.meta.url), 'utf8'));
  assert.equal(dashboard.history.length, chapter5ReplayVectors.length, 'Replay changes require a fresh model export');
  for (const [i, point] of dashboard.history.entries()) {
    const measurement = featureMeasurements(chapter5ReplayVectors[i]);
    assert.equal(Number(measurement.windSpeed.toFixed(2)), point.windSpeed, `Replay/model wind mismatch at ${i}`);
    assert.equal(Number(measurement.vibrationRms.toFixed(4)), point.vibrationRms, `Replay/model RMS mismatch at ${i}`);
    assert.equal(Number(measurement.modalF1.toFixed(2)), point.modalF1, `Replay/model modal mismatch at ${i}`);
  }
  // A wide nominal interval is retained, not narrowed to manufacture confidence.
  assert.ok(rulModel.evaluation.mpiw > 700);
});
test('display ordering/clipping retains exact raw model outputs and source scope', () => {
  for (const vector of chapter5ReplayVectors) {
    const result = predictRul(vector, 'chapter5-window');
    assert.deepEqual(result.rulEvidence.outsideTraining, [], 'Source training windows must not receive float-rounding domain warnings');
    assert.deepEqual(result.rulEvidence.rawQuantiles, predictRawQuantiles(vector));
    assert.ok(0 <= result.rulP10 && result.rulP10 <= result.rulP50 && result.rulP50 <= result.rulP90 && result.rulP90 <= 1000);
  }
  assert.match(rulDescription({ modelVersion: 'wt-demo-2.0' }), /legacy/);
  assert.match(rulDescription({ modelVersion: rulModel.version, rulEvidence: { featureSource: 'manual-override' } }), /not XGBoost/);
});
test('reference assistance, observed overrides and domain warnings remain explicit', () => {
  const values = referenceFeatures(8, 40);
  assert.equal(values.length, 31);
  const changed = scenarioFeatures(8, 40, { vibrationRms: .2, kurtosis: 8, modalF1: 22, rpm: 600 });
  const measurements = featureMeasurements(changed);
  assert.ok(Math.abs(measurements.vibrationRms - .2) < 1e-12);
  assert.equal(measurements.kurtosis, 8); assert.equal(measurements.modalF1, 22);
  assert.equal(predictRul(changed, 'reference-assisted').rulEvidence.featureSource, 'reference-assisted');
  assert.ok(predictRul(referenceFeatures(40, 80), 'reference-assisted').rulEvidence.outsideTraining.includes('wind_mean'));
});
test('complete named feature windows reject missing, nonnumeric, oversized or array inputs', () => {
  const named = Object.fromEntries(rulModel.featureNames.map((name, i) => [name, chapter5ReplayVectors[0][i]]));
  assert.deepEqual(readFeatureWindow(JSON.stringify({ features: named })), chapter5ReplayVectors[0]);
  assert.deepEqual(readFeatureWindow(JSON.stringify(named)), chapter5ReplayVectors[0]);
  for (const invalid of ['[]', '{}', JSON.stringify({ ...named, wind_mean: '8' }), ' '.repeat(100001)]) assert.throws(() => readFeatureWindow(invalid));
  assert.throws(() => predictRul([1], 'imported-window'));
});
