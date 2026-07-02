import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..", "..");
const dashboardRoot = resolve(scriptDir, "..");
const featuresPath = resolve(projectRoot, "Chapter 5 - Demonstration (Micro Wind Turbine)", "outputs", "features.csv");
const resultsPath = resolve(projectRoot, "Chapter 5 - Demonstration (Micro Wind Turbine)", "outputs", "all_results.json");
const outputPath = resolve(dashboardRoot, "src", "data", "dashboardData.json");

const site = {
  name: "Cranfield outdoor WT test site",
  lat: 52.0734,
  lon: -0.6283,
  altitude: 112,
  asset: "Turbine-01",
  component: "Blade-A",
  sourceStatus: "Chapter 5 controlled C0-C6 replay"
};

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    return Object.fromEntries(headers.map((header, index) => [header, cells[index]]));
  });
}

function number(row, key, fallback = 0) {
  const value = Number(row[key]);
  return Number.isFinite(value) ? value : fallback;
}

function serviceStateFromState(state, mapping) {
  return mapping?.[state] ?? "Nominal";
}

function syntheticDirection(row, index) {
  const base = row.wind_bin === "low" ? 214 : row.wind_bin === "mid" ? 238 : 264;
  return Math.round((base + Math.sin(index / 9) * 22 + (index % 7) * 2.5) % 360);
}

function pBand(rul, stateIndex) {
  const spread = Math.max(42, 118 - stateIndex * 8);
  return {
    p10: Math.max(0, Math.round(rul - spread)),
    p50: Math.round(rul),
    p90: Math.round(rul + spread * 0.82)
  };
}

const features = parseCsv(readFileSync(featuresPath, "utf8"));
const results = JSON.parse(readFileSync(resultsPath, "utf8"));
const stateMapping = results.service_state?.service_state_mapping ?? {};

const history = features.map((row, index) => {
  const state = row.state ?? "C0";
  const stateIndex = Number(state.replace("C", "")) || 0;
  const rul = number(row, "rul_h", 1000);
  const band = pBand(rul, stateIndex);
  const windSpeed = number(row, "wind_mean", 0);
  const rpm = number(row, "rpm", 0);
  const azRms = number(row, "az_rms", number(row, "ax_rms", 0));
  const axRms = number(row, "ax_rms", 0);
  const power = Math.round(Math.max(0, Math.min(430, Math.pow(windSpeed, 2.15) * 8.8 + rpm * 0.18)));

  return {
    t: `T+${String(index).padStart(3, "0")}`,
    acquisitionIndex: index,
    source: "features.csv",
    windSpeed: Number(windSpeed.toFixed(2)),
    windDirection: syntheticDirection(row, index),
    rpm: Math.round(rpm),
    power,
    vibrationRms: Number(azRms.toFixed(4)),
    axialRms: Number(axRms.toFixed(4)),
    kurtosis: Number(number(row, "az_kurtosis", number(row, "ax_kurtosis", 0)).toFixed(2)),
    modalF1: Number(number(row, "modal_f1", 0).toFixed(2)),
    modalF2: Number(number(row, "modal_f2", 0).toFixed(2)),
    modalF3: Number(number(row, "modal_f3", 0).toFixed(2)),
    crackState: state,
    crackMm: number(row, "crack_mm", 0),
    windBin: row.wind_bin ?? "unknown",
    rulP10: band.p10,
    rulP50: band.p50,
    rulP90: band.p90,
    serviceState: serviceStateFromState(state, stateMapping)
  };
});

const payload = {
  generatedAt: new Date().toISOString(),
  site,
  summary: {
    totalAcquisitions: results.data_summary?.total_acquisitions ?? history.length,
    featureDimensions: results.data_summary?.feature_dimensions ?? 31,
    crackStates: results.data_summary?.crack_states ?? ["C0", "C1", "C2", "C3", "C4", "C5", "C6"],
    sourceFiles: ["outputs/features.csv", "outputs/all_results.json"],
    evidenceBoundary: "WT quantitative records are the controlled Chapter 5 C0-C6 replay until measured campaign data replace them."
  },
  service: {
    stateMapping,
    transitions: results.service_state?.transitions ?? [],
    availability: results.service_state?.availability ?? null,
    kpiSettlement: results.service_state?.kpi_settlement ?? null,
    validationConditions: results.service_state?.validation_conditions ?? null
  },
  models: results.rul_full ?? {},
  history
};

writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Synced ${history.length} Chapter 5 records to ${outputPath}`);
