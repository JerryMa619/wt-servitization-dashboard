import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { chapter5ReplayVectors, featureMeasurements, predictRawQuantiles, predictRul, readFeatureWindow, referenceFeatures, rulDescription, rulUncertaintyDescription, rulModel, scenarioFeatures } from '../src/model/xgboost.ts';

const fixture = JSON.parse(readFileSync(new URL('../models/chapter5-calibrated/python-parity.json', import.meta.url), 'utf8'));
test('browser tree evaluation matches Python XGBoost on all windows and missing-value routes', () => {
  let maxError = 0;
  for (const [i, vector] of fixture.vectors.entries()) {
    const actual = predictRawQuantiles(vector.map((v) => v == null ? NaN : v));
    for (const [q, key] of ['p10', 'p50', 'p90'].entries()) {
      const error = Math.abs(actual[q] - fixture.predictions[key][i]);
      assert.ok(error <= fixture.tolerance, `${i} ${key}: ${error}`); maxError = Math.max(maxError, error);
    }
  }
  writeFileSync(new URL('../models/chapter5-calibrated/browser-parity.json', import.meta.url), JSON.stringify({ vectors: fixture.vectors.length, quantiles: 3, maxAbsoluteError: maxError, tolerance: fixture.tolerance }, null, 2) + '\n');
});
test('responsive configuration is separate from the preserved baseline and excludes labels', () => {
  assert.equal(rulModel.featureNames.length, 31);
  assert.deepEqual(rulModel.parameters, { n_estimators: 300, max_depth: 6, learning_rate: .05, objective: 'reg:quantileerror', random_state: 42, verbosity: 0, base_score: 500 });
  for (const label of ['state', 'crack_mm', 'wind_bin', 'rul_h']) assert.ok(!rulModel.featureNames.includes(label));
  for (const [name, hash] of Object.entries(rulModel.modelHashes)) assert.equal(createHash('sha256').update(readFileSync(new URL(`../models/chapter5-calibrated/${name}.json`, import.meta.url))).digest('hex'), hash);
  const baseline = JSON.parse(readFileSync(new URL('../models/chapter5/manifest.json', import.meta.url), 'utf8'));
  assert.ok(!('base_score' in baseline.parameters));
  for (const [name, hash] of Object.entries(baseline.modelHashes)) assert.equal(createHash('sha256').update(readFileSync(new URL(`../models/chapter5/${name}.json`, import.meta.url))).digest('hex'), hash);
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
  assert.ok(rulModel.evaluation.mpiw < rulModel.comparison.originalSameSplit.mpiw);
  assert.ok(rulModel.evaluation.picp >= rulModel.calibration.nominalCoverage);
});
test('display ordering/clipping retains exact raw model outputs and source scope', () => {
  for (const [i, vector] of chapter5ReplayVectors.entries()) {
    const result = predictRul(vector, 'chapter5-window');
    if (rulModel.split.train.includes(i)) assert.deepEqual(result.rulEvidence.outsideTraining, [], 'Source training windows must not receive float-rounding domain warnings');
    assert.deepEqual(result.rulEvidence.rawQuantiles, predictRawQuantiles(vector));
    assert.ok(0 <= result.rulP10 && result.rulP10 <= result.rulP50 && result.rulP50 <= result.rulP90 && result.rulP90 <= 1000);
    const raw = result.rulEvidence.rawQuantiles.map((v) => Math.max(0, Math.min(1000, v)));
    assert.equal(result.rulP10, Math.floor(Math.max(0, Math.min(...raw) - rulModel.calibration.radius)));
    assert.equal(result.rulP90, Math.ceil(Math.min(1000, Math.max(...raw) + rulModel.calibration.radius)));
  }
  assert.match(rulDescription({ modelVersion: 'wt-demo-2.0' }), /legacy/);
  assert.match(rulDescription({ modelVersion: rulModel.version, rulEvidence: { featureSource: 'manual-override' } }), /not XGBoost/);
  assert.match(rulUncertaintyDescription({ modelVersion: rulModel.version, rulEvidence: { featureSource: 'manual-override' } }), /not model uncertainty/);
});
test('train, calibration and test are disjoint; correction is the finite-sample calibration rank', () => {
  const splits = [rulModel.split.train, rulModel.split.calibration, rulModel.split.test];
  assert.deepEqual(splits.map((rows) => rows.length), [189, 63, 63]);
  assert.equal(new Set(splits.flat()).size, 315);
  const record = JSON.parse(readFileSync(new URL('../models/chapter5-calibrated/calibration.json', import.meta.url), 'utf8'));
  assert.deepEqual(record.indices, rulModel.split.calibration);
  assert.equal(record.rank, Math.ceil((record.indices.length + 1) * .8));
  assert.equal(record.radius, record.scores.toSorted((a, b) => a - b)[record.rank - 1]);
  for (const [i, row] of record.indices.entries()) {
    const raw = predictRawQuantiles(chapter5ReplayVectors[row]).map((v) => Math.max(0, Math.min(1000, v)));
    const label = fixture.targets[row];
    assert.ok(Math.abs(record.scores[i] - Math.max(Math.min(...raw) - label, label - Math.max(...raw), 0)) < 1e-6);
  }
});
test('reported held-out results match exported predictions, with no resubstitution scoring', () => {
  const rows = rulModel.split.test;
  const bounds = rows.map((i) => predictRawQuantiles(chapter5ReplayVectors[i]).map((v) => Math.max(0, Math.min(1000, v))));
  const errors = rows.map((i, j) => bounds[j][1] - fixture.targets[i]);
  const rmse = Math.sqrt(errors.reduce((sum, e) => sum + e * e, 0) / rows.length);
  const mae = errors.reduce((sum, e) => sum + Math.abs(e), 0) / rows.length;
  const lower = bounds.map((raw) => Math.max(0, Math.min(...raw) - rulModel.calibration.radius));
  const upper = bounds.map((raw) => Math.min(1000, Math.max(...raw) + rulModel.calibration.radius));
  const coverage = rows.filter((i, j) => lower[j] <= fixture.targets[i] && fixture.targets[i] <= upper[j]).length / rows.length;
  const width = upper.reduce((sum, hi, j) => sum + hi - lower[j], 0) / rows.length;
  for (const [key, actual] of Object.entries({ rmse, mae, picp: coverage, mpiw: width })) assert.ok(Math.abs(actual - rulModel.evaluation[key]) < 1e-6, key);
});
test('all three quantiles respond to source features, without manufactured per-frame noise', () => {
  for (const key of ['p10', 'p50', 'p90']) assert.ok(rulModel.diagnostics.roundedDistinctRawOutputs[key] > 20);
  for (const key of ['rulP10', 'rulP50', 'rulP90']) assert.ok(new Set(chapter5ReplayVectors.map((v) => predictRul(v, 'chapter5-window')[key])).size > 20);
  const values = referenceFeatures(8, 40);
  assert.deepEqual(predictRul(values, 'reference-assisted'), predictRul(values, 'reference-assisted'));
  assert.match(rulUncertaintyDescription({ modelVersion: rulModel.version, rulEvidence: predictRul(values, 'reference-assisted').rulEvidence }), /coverage not validated/);
  assert.equal(predictRul(referenceFeatures(40, 80), 'reference-assisted').rulEvidence.intervalCalibration.scope, 'out-of-domain');
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
