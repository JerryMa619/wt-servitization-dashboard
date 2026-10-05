import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  ClipboardCheck,
  ClipboardList,
  Database,
  Download,
  Gauge,
  MapPin,
  Network,
  Pause,
  Play,
  Radio,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Upload,
  Waves,
  Wind,
  Workflow,
  Wrench,
  X
} from "lucide-react";
import dashboardData from "./data/dashboardData.json";
import OntologyPanel, { type OntologyFocusRequest } from "./ontology/OntologyPanel";
import { actionTypes, updateExecutionLog, type OntologyExecution, type OntologySnapshot } from "./ontology/model";
import TwinWorkspace, { type ReplayRequest } from "./twin/TwinWorkspace";
import { advanceStats, conditionPrediction, conditionState, emptyStats, inputBounds, inputRangeErrors, modelMetadata, operatingOutput, readingFreshness, simulationAvailability, crackGrowthRate, type SimulationStats } from "./model/operating";
import { closeRestoredSession, interruptExecution, parseSession, sessionKey, type SavedSession } from "./model/session";
import { bladeSensorFields, bladeSensorReference, derivedConditionNote } from "./model/instrumentation";
import { chapter5ReplayVectors, featureMeasurements, predictRul, readFeatureWindow, rulDescription, rulUncertaintyDescription, rulModel, type RulEvidence } from "./model/xgboost";
import Chart from "./components/TelemetryPanel";
import VibrationCharts from "./vibration/VibrationCharts";
import { vibrationFeatures } from "./vibration/model";
import { maintenanceActions, serviceEconomics, tcsParameters, serviceDecisionByTcs, serviceCandidatesForState, isRiskAcceptableAfterAction, estimateTcs, residualRiskAfterAction } from './model/service';
import './research/research.css';
const PolicyComparison = lazy(() => import('./research/PolicyComparison'));
const demoCases = [{ id: 'healthy', label: 'Healthy start / 0 mm', crack: 0 }, { id: 'growth', label: 'Growing crack / 25 mm', crack: 25 }, { id: 'service', label: 'Service threshold / 45 mm', crack: 45 }, { id: 'damage', label: 'High damage / 65 mm', crack: 65 }];

type ServiceState = "Nominal" | "Watch" | "Degraded" | "MaintenanceDue" | "Critical" | "OutOfContract";
type MaintenanceActionKey =
  | "condition-inspection"
  | "preactive-maintenance"
  | "predictive-maintenance"
  | "proactive-maintenance"
  | "active-maintenance"
  | "corrective-maintenance"
  | "spare-prepositioning";

type HistoryPoint = {
  t: string;
  acquisitionIndex?: number;
  source?: string;
  modelVersion?: string;
  rulEvidence?: RulEvidence;
  rulFeatureVector?: number[];
  observedAt?: string;
  receivedAt?: string;
  windSpeed: number;
  windDirection: number;
  rpm: number;
  power: number;
  vibrationRms: number;
  axialRms?: number;
  kurtosis: number;
  modalF1: number;
  modalF2?: number;
  modalF3?: number;
  crackState?: string;
  crackMm?: number;
  windBin?: string;
  rulP10: number;
  rulP50: number;
  rulP90: number;
  serviceState?: ServiceState;
  lat?: number;
  lon?: number;
  serviceMode?: "in-downtime" | "post-service";
  serviceAction?: MaintenanceActionKey;
  downtimeH?: number;
  elapsedDowntimeH?: number;
  availabilityPct?: number;
  serviceNote?: string;
  crackGrowthRateMmH?: number;
};

type LivePosition = {
  lat: number;
  lon: number;
  accuracy?: number;
  source: "Chapter 5 replay GPS" | "Device GPS" | "Manual input GPS";
  updatedAt: string;
};

type ScenarioForm = {
  lat: number;
  lon: number;
  windSpeed: number;
  windDirection: number;
  rpm: number;
  power: number;
  vibrationRms: number;
  kurtosis: number;
  modalF1: number;
  crackMm: number;
  rulP10: number;
  rulP50: number;
  rulP90: number;
};

type ServiceExecution = {
  action: MaintenanceActionKey;
  downtimeH: number;
  status: "in-progress" | "completed" | "interrupted";
  note: string;
  mode?: "manual" | "auto";
  ontology?: OntologyExecution;
};

type AutoServiceRuntime = {
  action: MaintenanceActionKey;
  downtimeH: number;
  ticksRemaining: number;
  totalTicks: number;
  preServicePoint: HistoryPoint;
  ontology: OntologyExecution;
};

type AutoServiceStats = SimulationStats;

type ServiceCostEstimate = {
  action: MaintenanceActionKey;
  totalCost: number;
  directCost: number;
  downtimeCost: number;
  logisticsCost: number;
  contractCost: number;
  residualRiskCost: number;
  residualRiskScore: number;
  residualCrackMm: number;
  residualRulP10: number;
};

type DashboardDataset = {
  generatedAt: string;
  site: {
    name: string;
    lat: number;
    lon: number;
    altitude: number;
    asset: string;
    component: string;
    sourceStatus: string;
  };
  summary: {
    totalAcquisitions: number;
    featureDimensions: number;
    evidenceBoundary: string;
  };
  service: {
    availability: {
      availability: number;
      total_hours?: number;
      planned_downtime_h?: number;
      unplanned_downtime_h?: number;
      description: string;
    } | null;
    kpiSettlement: { actual_availability: number; contractual_target: number; delta_pp: number; settlement_gbp: number; status: string } | null;
    validationConditions?: {
      VC1_latency?: { p95_ms: number; vc1_pass: boolean };
      VC2_provenance?: { audit_rate_pct: number; vc2_pass: boolean; issues?: string[] };
      VC3_delta_availability?: {
        baseline_availability: number;
        baseline_downtime_h: number;
        dt_availability: number;
        delta_pp: number;
        vc3_pass: boolean;
      };
    };
  };
  history: HistoryPoint[];
};

const dataset = dashboardData as DashboardDataset;
const replayHistory = (dataset.history ?? []).map((point, index) => {
  const values = chapter5ReplayVectors[index];
  return values ? { ...point, ...predictRul(values, 'chapter5-window'), modelVersion: rulModel.version, rulFeatureVector: values } : point;
});

const fallbackSite = {
  name: "Cranfield outdoor WT test site",
  lat: 52.0734,
  lon: -0.6283,
  altitude: 112,
  asset: "Turbine-01",
  component: "Blade-A",
  sourceStatus: "Fallback simulated stream"
};

const site = dataset.site ?? fallbackSite;


function serviceStateFromCondition(point: Pick<HistoryPoint, "rulP10" | "crackMm" | "vibrationRms" | "kurtosis">): ServiceState {
  return conditionState(point);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function makePoint(index: number, prior?: HistoryPoint): HistoryPoint {
  const now = new Date(Date.now() - (47 - index) * 90_000);
  const gust = Math.sin(index / 2.8) * 0.45 + Math.random() * 0.35;
  const windSpeed = clamp((prior?.windSpeed ?? 5.8) + gust * 0.22, 3.2, 9.8);
  const windDirection = Math.round(((prior?.windDirection ?? 226) + 8 + Math.random() * 18) % 360);
  const crackMm = prior?.crackMm ?? 0;
  const speed = Number(windSpeed.toFixed(2));

  return {
    t: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    source: 'auto-simulation',
    modelVersion: modelMetadata.version,
    observedAt: now.toISOString(),
    receivedAt: new Date().toISOString(),
    windSpeed: speed,
    windDirection,
    crackMm,
    crackState: crackStateFromMm(crackMm),
    ...operatingOutput(speed),
    ...conditionPrediction(speed, crackMm)
  };
}

function makeInitialHistory() {
  const points: HistoryPoint[] = [];
  for (let i = 0; i < 48; i += 1) {
    points.push(makePoint(i, points[i - 1]));
  }
  return points;
}

function makeInitialReplayHistory() {
  if (replayHistory.length === 0) return makeInitialHistory();

  const firstCrackIndex = replayHistory.findIndex((point) => (point.crackMm ?? 0) > 0);
  const initialLength = firstCrackIndex > 0 ? firstCrackIndex : Math.min(1, replayHistory.length);
  return replayHistory.slice(0, initialLength);
}

const stateMeta: Record<ServiceState, { color: string; bg: string; action: string; kpi: string }> = {
  Nominal: {
    color: "#16835b",
    bg: "#e8f7f0",
    action: "Continue normal operation",
    kpi: "Availability protected"
  },
  Watch: {
    color: "#b7791f",
    bg: "#fff5dd",
    action: "Enhanced monitoring and inspection",
    kpi: "Availability under watch"
  },
  Degraded: {
    color: "#c05621",
    bg: "#fff0e6",
    action: "Plan service window and pre-position spares",
    kpi: "Energy yield at risk"
  },
  MaintenanceDue: {
    color: "#b83232",
    bg: "#ffe8e8",
    action: "Execute planned blade maintenance",
    kpi: "Contract penalty exposure"
  },
  Critical: {
    color: "#7f1d1d",
    bg: "#ffe1e1",
    action: "Derate or hold asset",
    kpi: "Safety boundary active"
  },
  OutOfContract: {
    color: "#6f1d1b",
    bg: "#ffe1dc",
    action: "Remove asset from contract envelope",
    kpi: "Out-of-contract condition"
  }
};

function readDashboardSession(): { data: SavedSession | null; error: string | null } {
  try {
    const raw = localStorage.getItem(sessionKey(site.asset));
    return { data: raw ? closeRestoredSession(parseSession(raw, site.asset)) : null, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : "Local history unavailable" };
  }
}

function refreshActivePrediction(reading: SavedSession['latest']): SavedSession['latest'] {
  if (!reading.modelVersion?.startsWith('ch5-xgb-') || reading.modelVersion === rulModel.version || reading.rulEvidence?.featureSource === 'manual-override') return reading;
  if (reading.rulFeatureVector && reading.rulEvidence) return { ...reading, ...predictRul(reading.rulFeatureVector, reading.rulEvidence.featureSource), modelVersion: rulModel.version };
  return reading;
}

function restoredPoint(reading: SavedSession['latest']): HistoryPoint {
  const point = { ...refreshActivePrediction(reading), ...operatingOutput(reading.windSpeed), serviceMode: undefined, serviceAction: undefined, downtimeH: undefined } as HistoryPoint;
  return { ...point, serviceState: serviceStateFromCondition(point) };
}

function restoredManual(reading: SavedSession['manual']): HistoryPoint | null {
  if (!reading) return null;
  const point = refreshActivePrediction(reading);
  return { ...point, source: "manual-input", serviceState: serviceStateFromCondition(point) } as HistoryPoint;
}

function App() {
  const basePath = import.meta.env.BASE_URL.replace(/\/+$/, "");
  const currentPath = window.location.pathname.replace(/\/+$/, "");
  const routePath = basePath && currentPath.startsWith(basePath) ? currentPath.slice(basePath.length) || "/" : currentPath || "/";
  const enhancedMode = routePath === "/enhanced";
  const standardDashboardHref = import.meta.env.BASE_URL;
  const enhancedDashboardHref = `${import.meta.env.BASE_URL.replace(/\/+$/, "")}/enhanced`;
  const [bootstrap] = useState(readDashboardSession);
  const [cursor, setCursor] = useState(bootstrap.data?.cursor ?? 0);
  const [history, setHistory] = useState<HistoryPoint[]>(() =>
    bootstrap.data ? [restoredPoint(bootstrap.data.latest)] : makeInitialReplayHistory()
  );
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [inputOpen, setInputOpen] = useState(false);
  const [manualPoint, setManualPoint] = useState<HistoryPoint | null>(restoredManual(bootstrap.data?.manual ?? null));
  const [serviceExecution, setServiceExecution] = useState<ServiceExecution | null>(null);
  const [ontologyEvents, setOntologyEvents] = useState<OntologyExecution[]>(bootstrap.data?.events ?? []);
  const [ontologyFocus, setOntologyFocus] = useState<OntologyFocusRequest | null>(null);
  const [replayRequest, setReplayRequest] = useState<ReplayRequest | null>(null);
  const [autoStats, setAutoStats] = useState<AutoServiceStats>(bootstrap.data?.stats ?? emptyStats());
  const [storageReady, setStorageReady] = useState(!bootstrap.error);
  const [storageMessage, setStorageMessage] = useState(bootstrap.error ?? "Local history enabled");
  const [storageWarning, setStorageWarning] = useState(!!bootstrap.error);
  const [historyError, setHistoryError] = useState<string | null>(bootstrap.error);
  const importRef = useRef<HTMLInputElement | null>(null);
  const [devicePosition, setDevicePosition] = useState<LivePosition | null>(null);
  const devicePositionRef = useRef<LivePosition | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const gpsWatchRef = useRef<number | null>(null);
  const manualPointRef = useRef<HistoryPoint | null>(manualPoint);
  const autoServiceRef = useRef<AutoServiceRuntime | null>(null);
  const autoPostServiceOverrideRef = useRef(!!bootstrap.data);
  const autoCooldownRef = useRef(0);
  const ontologySessionRef = useRef(bootstrap.data?.sessionId ?? crypto.randomUUID());
  const historyRef = useRef(history);
  const linkedRequestRef = useRef(0);
  const [simulationPaused, setSimulationPaused] = useState(false);
  const pausedRef = useRef(false);
  const [demoCase, setDemoCase] = useState('');
  const demoPointRef = useRef<HistoryPoint | null>(null);
  const demoBackupRef = useRef<SavedSession | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (manualPointRef.current || pausedRef.current) return;
      const current = historyRef.current;
        const prior = current[current.length - 1];
        const replayPoint =
          demoPointRef.current ?? (replayHistory.length > 0 ? replayHistory[cursor % replayHistory.length] : makePoint(current.length, prior));
        let next = replayPoint;

        if (!manualPointRef.current) {
          const activeService = autoServiceRef.current;

          if (activeService) {
            if (activeService.ticksRemaining > 1) {
              const previousElapsed = activeService.ontology.progress?.elapsedH ?? 0;
              activeService.ticksRemaining -= 1;
              next = makeDowntimePoint(activeService.preServicePoint, activeService);
              const during = ontologySnapshot(next, demoPointRef.current ? replayGpsPosition(next) : devicePositionRef.current ?? replayGpsPosition(next), `${ontologySessionRef.current}-service-${cursor}-during`);
              activeService.ontology = {
                ...activeService.ontology,
                during: [...(activeService.ontology.during ?? []), during],
                progress: { elapsedH: next.elapsedDowntimeH ?? 0, totalH: activeService.downtimeH }
              };
              const elapsed = (next.elapsedDowntimeH ?? 0) - previousElapsed;
              setAutoStats((stats) => advanceStats(stats, elapsed, elapsed));
              setServiceExecution({ action: activeService.action, downtimeH: activeService.downtimeH, status: "in-progress", mode: "auto", note: next.serviceNote ?? "Simulated downtime", ontology: activeService.ontology });
            } else {
              next = applyMaintenanceResult(activeService.preServicePoint, activeService.action, activeService.downtimeH);
              next = {
                ...next,
                serviceNote: `Auto closed-loop ${maintenanceActions[activeService.action].label} completed; WT state refreshed after downtime.`
              };
              autoServiceRef.current = null;
              autoPostServiceOverrideRef.current = true;
              autoCooldownRef.current = 8;
              const elapsed = activeService.downtimeH - (activeService.ontology.progress?.elapsedH ?? 0);
              setAutoStats((stats) => advanceStats(stats, elapsed, elapsed, { action: activeService.action, at: next.t }));
              setServiceExecution({
                action: activeService.action,
                downtimeH: activeService.downtimeH,
                status: "completed",
                mode: "auto",
                ontology: {
                  ...activeService.ontology,
                  status: "completed",
                  progress: { elapsedH: activeService.downtimeH, totalH: activeService.downtimeH },
                  after: ontologySnapshot(next, demoPointRef.current ? replayGpsPosition(next) : devicePositionRef.current ?? replayGpsPosition(next), `${ontologySessionRef.current}-service-${cursor}-after`)
                },
                note: `${maintenanceActions[activeService.action].label} completed automatically; crack, RUL and vibration are updated.`
              });
            }
          } else {
            next = simulateAutoTwinPoint(replayPoint, prior, cursor, !autoPostServiceOverrideRef.current);
            setAutoStats((stats) => advanceStats(stats, modelMetadata.monitorStepH, 0));
            if (autoCooldownRef.current > 0) {
              autoCooldownRef.current -= 1;
            } else {
              const action = automaticMaintenanceAction(next);
              if (action) {
                const downtimeH = maintenanceActions[action].defaultDowntimeH;
                const runtime = {
                  action,
                  downtimeH,
                  ticksRemaining: downtimeTicksFromHours(downtimeH),
                  totalTicks: downtimeTicksFromHours(downtimeH),
                  preServicePoint: next,
                  ontology: {
                    id: `${ontologySessionRef.current}-service-${cursor}`,
                    action,
                    label: maintenanceActions[action].label,
                    status: "in-progress" as const,
                    downtimeH,
                    during: [] as OntologySnapshot[],
                    progress: { elapsedH: 0, totalH: downtimeH },
                    before: ontologySnapshot(next, demoPointRef.current ? replayGpsPosition(next) : devicePositionRef.current ?? replayGpsPosition(next), `${ontologySessionRef.current}-service-${cursor}-before`)
                  }
                };
                autoServiceRef.current = runtime;
                next = makeDowntimePoint(next, runtime);
                runtime.ontology.during.push(ontologySnapshot(next, demoPointRef.current ? replayGpsPosition(next) : devicePositionRef.current ?? replayGpsPosition(next), `${ontologySessionRef.current}-service-${cursor}-during`));
                setServiceExecution({
                  action,
                  downtimeH,
                  status: "in-progress",
                  mode: "auto",
                  ontology: runtime.ontology,
                  note: `Auto DT selected ${maintenanceActions[action].label} from crack/RUL evidence.`
                });
              }
            }
          }
        }

      next = { ...next, ...(demoPointRef.current ? { t: `Demo tick ${String(cursor + 1).padStart(3, '0')}` } : {}), observedAt: new Date().toISOString(), receivedAt: new Date().toISOString() };
      const nextHistory = [...current, next].slice(-48);
      historyRef.current = nextHistory;
      setHistory(nextHistory);
      setCursor((current) => current + 1);
    }, 1400);

    return () => window.clearInterval(timer);
  }, [cursor]);

  useEffect(() => {
    if (serviceExecution?.ontology) setOntologyEvents((current) => updateExecutionLog(current, serviceExecution.ontology!));
  }, [serviceExecution]);

  useEffect(() => {
    if (!storageReady || demoPointRef.current) return;
    try {
      const value: SavedSession = { version: 1, asset: site.asset, events: ontologyEvents, stats: autoStats, latest: history[history.length - 1], manual: manualPoint, cursor, sessionId: ontologySessionRef.current };
      localStorage.setItem(sessionKey(site.asset), JSON.stringify(value));
      setStorageMessage("Saved locally / latest 30 events");
      setStorageWarning(false);
    } catch {
      setStorageMessage("Local storage unavailable; export history to retain evidence");
      setStorageWarning(true);
    }
  }, [ontologyEvents, autoStats, history, manualPoint, cursor, storageReady]);

  useEffect(() => {
    return () => {
      if (gpsWatchRef.current != null && "geolocation" in navigator) {
        navigator.geolocation.clearWatch(gpsWatchRef.current);
      }
    };
  }, []);

  const streamedLatest = history[history.length - 1];
  const latest = manualPoint ?? streamedLatest;
  const serviceState = latest.serviceState ?? serviceStateFromCondition(latest);
  const meta = stateMeta[serviceState];
  const chartHistory = manualPoint ? [...history.slice(1), manualPoint] : history;
  const bladeFeatures = vibrationFeatures(latest);
  const timeLabels = chartHistory.map((point) => point.t);
  const replayPosition = replayGpsPosition(latest);
  const manualPosition: LivePosition | null =
    manualPoint?.lat != null && manualPoint.lon != null
      ? {
          lat: manualPoint.lat,
          lon: manualPoint.lon,
          source: "Manual input GPS",
          updatedAt: manualPoint.t
        }
      : null;
  const currentPosition = demoCase ? replayPosition : manualPosition ?? devicePosition ?? replayPosition;
  const liveSnapshot = useMemo(() => ontologySnapshot(latest, currentPosition, `${ontologySessionRef.current}-reading-${cursor}-${latest.source ?? "replay"}`), [latest, currentPosition.lat, currentPosition.lon, currentPosition.source, cursor]);

  function focusOntology(nodeId: string, eventId: string, snapshot?: OntologySnapshot, execution?: OntologyExecution) {
    setOntologyFocus({ id: ++linkedRequestRef.current, nodeId, eventId, snapshot, execution });
    document.getElementById("ontology-module")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function applyManualScenario(point: HistoryPoint) {
    manualPointRef.current = point;
    const runtime = autoServiceRef.current;
    if (runtime) {
      const interrupted = interruptExecution(runtime.ontology, "Manual scenario replaced the automatic intervention");
      setOntologyEvents((current) => updateExecutionLog(current, interrupted));
      setServiceExecution({ action: runtime.action, downtimeH: runtime.downtimeH, status: "interrupted", mode: "auto", ontology: interrupted, note: interrupted.endReason! });
      autoServiceRef.current = null;
      autoCooldownRef.current = 8;
    }
    setManualPoint(point);
    setInputOpen(false);
  }

  function pauseSimulation(paused = true) { pausedRef.current = paused; setSimulationPaused(paused); }

  function startDemo(id: string) {
    const selected = demoCases.find(c => c.id === id);
    if (!selected) return;
    if (!demoBackupRef.current) {
      const active = autoServiceRef.current;
      if (active && !window.confirm('Start an isolated demo and interrupt the current simulated intervention? Incurred downtime is preserved in the original session.')) return;
      const events = active ? updateExecutionLog(ontologyEvents, interruptExecution(active.ontology, 'Interrupted before isolated viva demo')) : ontologyEvents;
      const saved: SavedSession = { version: 1, asset: site.asset, events, stats: autoStats, latest: historyRef.current[historyRef.current.length - 1], manual: manualPointRef.current, cursor, sessionId: ontologySessionRef.current };
      demoBackupRef.current = structuredClone(saved);
      if (storageReady) { try { localStorage.setItem(sessionKey(site.asset), JSON.stringify(saved)); } catch { setStorageWarning(true); setStorageMessage('Original session preserved in memory only; export before closing'); } }
    }
    const point: HistoryPoint = { t: 'Demo tick 000', source: 'auto-simulation', modelVersion: rulModel.version, windSpeed: 8, windDirection: 226, crackMm: selected.crack, crackState: crackStateFromMm(selected.crack), ...operatingOutput(8), ...conditionPrediction(8, selected.crack), observedAt: new Date().toISOString(), receivedAt: new Date().toISOString() };
    point.serviceState = serviceStateFromCondition(point);
    demoPointRef.current = point; autoServiceRef.current = null; autoPostServiceOverrideRef.current = true; autoCooldownRef.current = 0;
    manualPointRef.current = null; historyRef.current = [point]; ontologySessionRef.current = `demo-${crypto.randomUUID()}`;
    pauseSimulation(); setDemoCase(id); setHistory([point]); setManualPoint(null); setCursor(0); setOntologyEvents([]); setAutoStats(emptyStats()); setServiceExecution(null);
    setOntologyFocus({ id: ++linkedRequestRef.current, nodeId: 'recommendation', eventId: 'live' }); setReplayRequest({ id: ++linkedRequestRef.current, eventId: 'live' });
  }

  function returnToSession() {
    const saved = demoBackupRef.current; if (!saved) return;
    const point = restoredPoint(saved.latest), manual = restoredManual(saved.manual);
    demoPointRef.current = null; demoBackupRef.current = null; autoServiceRef.current = null; autoPostServiceOverrideRef.current = true; autoCooldownRef.current = 8;
    historyRef.current = [point]; manualPointRef.current = manual; ontologySessionRef.current = saved.sessionId;
    pauseSimulation(); setDemoCase(''); setHistory([point]); setManualPoint(manual); setCursor(saved.cursor); setOntologyEvents(saved.events); setAutoStats(saved.stats); setServiceExecution(null);
    setOntologyFocus({ id: ++linkedRequestRef.current, nodeId: 'recommendation', eventId: 'live' }); setReplayRequest({ id: ++linkedRequestRef.current, eventId: 'live' });
  }

  function exportHistory() {
    const value: SavedSession = { version: 1, asset: site.asset, events: ontologyEvents, stats: autoStats, latest: historyRef.current[historyRef.current.length - 1], manual: manualPointRef.current, cursor, sessionId: ontologySessionRef.current };
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${demoCase ? 'demo-' : ''}${site.asset}-service-history.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importHistory(file: File) {
    try {
      if (file.size > 4_000_000) throw new Error("History file exceeds 4 MB.");
      const session = closeRestoredSession(parseSession(await file.text(), site.asset));
      if (autoServiceRef.current) throw new Error("Finish or interrupt the current intervention before importing history.");
      const point = restoredPoint(session.latest);
      historyRef.current = [point];
      manualPointRef.current = restoredManual(session.manual);
      ontologySessionRef.current = session.sessionId;
      autoPostServiceOverrideRef.current = true;
      autoCooldownRef.current = 8;
      setHistory([point]);
      setCursor(session.cursor);
      setManualPoint(restoredManual(session.manual));
      setOntologyEvents(session.events);
      setAutoStats(session.stats);
      setServiceExecution(null);
      setOntologyFocus({ id: ++linkedRequestRef.current, nodeId: "recommendation", eventId: "live" });
      setReplayRequest({ id: ++linkedRequestRef.current, eventId: "live" });
      setStorageReady(true);
      setStorageWarning(false);
      setStorageMessage("History imported");
      setHistoryError(null);
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "History import failed");
    }
  }

  function clearHistory() {
    if (autoServiceRef.current || !window.confirm("Clear locally saved service history and simulation totals?")) return;
    setOntologyEvents([]);
    setAutoStats(emptyStats());
    setServiceExecution(null);
    setOntologyFocus({ id: ++linkedRequestRef.current, nodeId: "recommendation", eventId: "live" });
    setReplayRequest({ id: ++linkedRequestRef.current, eventId: "live" });
    ontologySessionRef.current = crypto.randomUUID();
    setStorageReady(true);
    setHistoryError(null);
  }

  function enableDeviceGps() {
    if (!("geolocation" in navigator)) {
      setGpsError("Browser geolocation is not available on this device.");
      return;
    }

    if (gpsWatchRef.current != null) {
      navigator.geolocation.clearWatch(gpsWatchRef.current);
      gpsWatchRef.current = null;
    }

    setGpsError(null);
    gpsWatchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const live: LivePosition = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
          source: "Device GPS",
          updatedAt: new Date(position.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        };
        devicePositionRef.current = live;
        setDevicePosition(live);
      },
      (error) => {
        setGpsError(error.message);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  }

  return (
    <main className="dashboard">
      <header className="topbar">
        <div>
          <p className="eyebrow">WT Servitization Digital Twin</p>
          <h1>{enhancedMode ? "Enhanced Operation, Service and Cost Intelligence" : "Operation, Evidence Chain and Contract State"}</h1>
          <span className="data-source">
            {manualPoint ? "Manual scenario mode" : "Auto DT closed-loop simulation"} | {dataset.summary?.totalAcquisitions ?? replayHistory.length} acquisitions | {site.sourceStatus}
          </span>
        </div>
        <div className="top-actions">
          <a className="secondary-action" href={enhancedMode ? standardDashboardHref : enhancedDashboardHref}>
            <Workflow size={15} />
            {enhancedMode ? "Standard dashboard" : "Enhanced dashboard"}
          </a>
          <button className="secondary-action" type="button" onClick={() => setInputOpen(true)}>
            <SlidersHorizontal size={15} />
            Input scenario
          </button>
          {manualPoint ? (
            <button className="secondary-action" type="button" onClick={() => { manualPointRef.current = null; setManualPoint(null); }}>
              <RotateCcw size={15} />
              Resume simulation
            </button>
          ) : null}
          <div className="status-pill" style={{ color: meta.color, background: meta.bg }}>
            <ShieldCheck size={18} />
            <span>{serviceState}</span>
          </div>
        </div>
      </header>

      <section className="demo-toolbar" aria-label="WT viva controls">
        <label>Viva case<select aria-label="WT viva case" value={demoCase} onChange={e => { if (e.target.value) startDemo(e.target.value); else returnToSession(); }}><option value="">Current session</option>{demoCases.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
        <button aria-label={simulationPaused ? 'Play WT simulation' : 'Pause WT simulation'} title={simulationPaused ? 'Play WT simulation' : 'Pause WT simulation'} onClick={() => pauseSimulation(!simulationPaused)}>{simulationPaused ? <Play size={16} /> : <Pause size={16} />}</button>
        <button title="Reset isolated demo" aria-label="Reset isolated demo" disabled={!demoCase} onClick={() => startDemo(demoCase)}><RotateCcw size={16} /></button>
        {demoCase && <button onClick={returnToSession}><RotateCcw size={15} />Return to saved session</button>}
        <span role="status">{demoCase ? 'Isolated in-memory demo / 8 m/s / original session preserved' : 'Current session'} / {simulationPaused || manualPoint ? 'Paused' : 'Running'} / 1 monitoring tick = 1 modeled h</span>
        <a href={`${import.meta.env.BASE_URL}cmapss/?story=1`}>C-MAPSS case study</a>
      </section>

      <section className="metric-row" aria-label="Live WT metrics">
        <Metric icon={<MapPin />} label="GPS" value={`${currentPosition.lat.toFixed(4)}, ${currentPosition.lon.toFixed(4)}`} sub={currentPosition.source} />
        <Metric icon={<Wind />} label="Wind speed" value={`${latest.windSpeed.toFixed(1)} m/s`} sub={`${cardinal(latest.windDirection)} ${latest.windDirection} deg`} />
        <Metric icon={<Gauge />} label="Rotor RPM" value={`${latest.rpm}`} sub={`${latest.power} W output`} />
        <Metric icon={<Activity />} label="Blade vibration" value={`${(bladeFeatures.rms[0] ?? latest.vibrationRms).toFixed(3)} g`} sub={`${bladeFeatures.rms[0] == null ? 'Z' : 'X / flapwise'} | ${latest.crackState ?? "C?"} | k ${(bladeFeatures.kurtosis[0] ?? latest.kurtosis).toFixed(2)}`} />
        <Metric icon={<Waves />} label="Blade RUL" value={`${latest.rulP10} / ${latest.rulP50} / ${latest.rulP90} pseudo-h`} sub={rulDescription(latest)} />
      </section>

      <div className="history-toolbar" aria-label="Saved service history"><span role={historyError || storageWarning ? "alert" : "status"} className={historyError || storageWarning ? "history-warning" : ""}>{historyError ?? (storageWarning ? storageMessage : demoCase ? "Demo history / in memory only" : storageMessage)}</span><span>{ontologyEvents.length} events / {autoStats.observationHours.toFixed(1)} modeled h</span><button title="Export service history" aria-label="Export service history" onClick={exportHistory}><Download size={16} /></button><button title="Import service history" aria-label="Import service history" disabled={!!demoCase || serviceExecution?.status === "in-progress"} onClick={() => importRef.current?.click()}><Upload size={16} /></button><input ref={importRef} type="file" accept="application/json,.json" aria-label="History JSON file" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) void importHistory(file); e.target.value = ""; }} /><button title="Clear service history" aria-label="Clear service history" disabled={!!demoCase || serviceExecution?.status === "in-progress"} onClick={clearHistory}><Trash2 size={16} /></button></div>

      <TwinWorkspace
        snapshot={liveSnapshot}
        executions={ontologyEvents}
        activeExecution={serviceExecution?.ontology ?? null}
        request={replayRequest}
        renderTurbine={(view, select, selected) => <TurbinePanel latest={view.reading as HistoryPoint} serviceState={view.serviceState as ServiceState} paused={simulationPaused} embedded linked={selected === "condition" || selected === "rul" || selected === "tcs" || selected === "recommendation"} onCrackSelect={() => select("condition")} onRulSelect={() => select("rul")} />}
        onOntology={focusOntology}
        onCosts={() => document.getElementById("tcs-panel")?.scrollIntoView({ behavior: "smooth", block: "start" })}
      />

      <section className="main-grid support-grid">
        <div className="asset-column">
          <SiteMap latest={latest} serviceState={serviceState} position={currentPosition} gpsError={gpsError} onEnableGps={enableDeviceGps} />
        </div>
        <DecisionPanel
          latest={latest}
          serviceState={serviceState}
          execution={serviceExecution}
          autoStats={autoStats}
          onEvidence={() => setEvidenceOpen(true)}
        />
      </section>

      <div id="ontology-module"><OntologyPanel
        snapshot={liveSnapshot}
        onPause={() => pauseSimulation()}
        executions={ontologyEvents}
        focusRequest={ontologyFocus}
        onReplay={(eventId) => {
          setReplayRequest({ id: ++linkedRequestRef.current, eventId });
          document.getElementById("twin-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      /></div>

      <Suspense fallback={<p className="research-scope">Loading policy comparison</p>}><PolicyComparison /></Suspense>

      {enhancedMode ? (
        <EnhancedDashboardModules
          latest={latest}
          history={chartHistory}
          serviceState={serviceState}
          execution={serviceExecution}
          autoStats={autoStats}
          events={ontologyEvents}
          position={currentPosition}
        />
      ) : null}

      <section className="chart-grid" aria-label="Dynamic telemetry charts">
        <Chart title="Wind Speed" option={lineOption(timeLabels, [{ name: "m/s", data: chartHistory.map((p) => p.windSpeed), color: "#26876d" }], "m/s")} />
        <Chart title="Wind Direction" option={directionOption(latest.windDirection)} />
        <Chart title="Blade RUL Uncertainty" option={rulOption(timeLabels, chartHistory)} />
        <VibrationCharts history={chartHistory} latest={latest} />
      </section>

      <section className="evidence-note">
        <AlertTriangle size={17} />
        <span>{dataset.summary?.evidenceBoundary ?? "Dashboard is using fallback simulated data."}</span>
      </section>

      {evidenceOpen ? <EvidenceModal latest={latest} serviceState={serviceState} position={currentPosition} onClose={() => setEvidenceOpen(false)} /> : null}
      {inputOpen ? (
        <ScenarioInputModal
          latest={latest}
          position={currentPosition}
          onClose={() => setInputOpen(false)}
          onApply={applyManualScenario}
        />
      ) : null}
    </main>
  );
}

function Metric({ icon, label, value, sub }: { icon: JSX.Element; label: string; value: string; sub: string }) {
  return (
    <article className="metric">
      <div className="metric-icon">{icon}</div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{sub}</span>
      </div>
    </article>
  );
}

function SiteMap({
  latest,
  serviceState,
  position,
  gpsError,
  onEnableGps
}: {
  latest: HistoryPoint;
  serviceState: ServiceState;
  position: LivePosition;
  gpsError: string | null;
  onEnableGps: () => void;
}) {
  const meta = stateMeta[serviceState];
  const center: [number, number] = [position.lat, position.lon];
  const [offlineMap, setOfflineMap] = useState(() => !navigator.onLine);
  const [tileError, setTileError] = useState(false);
  const windEnd = bearingDestination(position.lat, position.lon, latest.windDirection, 0.22);
  const turbineIcon = L.divIcon({
    className: "wt-leaflet-icon",
    html: `<div class="wt-map-pin" style="border-color:${meta.color}; color:${meta.color}"><span></span></div>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21]
  });
  const windIcon = L.divIcon({
    className: "wt-leaflet-icon",
    html: `<div class="wt-wind-bearing" style="transform: rotate(${latest.windDirection}deg)"><svg width="42" height="42" viewBox="0 0 42 42" aria-hidden="true"><path d="M21 4 L29 23 L21 19 L13 23 Z" fill="#4d78bd"/><circle cx="21" cy="21" r="17" fill="none" stroke="#4d78bd" stroke-width="3"/></svg></div>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21]
  });

  return (
    <section className="panel site-panel">
      <div className="section-title">
        <MapPin size={18} />
        <h2>GPS and Real Site Map</h2>
      </div>
      <div className="leaflet-map-shell">
        <MapContainer center={center} zoom={15} scrollWheelZoom={false} className="leaflet-map">
          <MapRecenter center={center} />
          {!offlineMap && <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" eventHandlers={{ tileerror: () => setTileError(true) }} />}
          <Polyline positions={[center, windEnd]} pathOptions={{ color: "#4d78bd", weight: 4, opacity: 0.65 }} />
          <Marker position={center} icon={turbineIcon}>
            <Popup>
              <strong>{site.asset}</strong>
              <br />
              {site.component}
              <br />
              GPS: {position.lat.toFixed(5)}, {position.lon.toFixed(5)}
              <br />
              State: {serviceState}
              <br />
              RUL p10/p50/p90: {latest.rulP10}/{latest.rulP50}/{latest.rulP90} pseudo-h
            </Popup>
          </Marker>
          <Marker position={windEnd} icon={windIcon}>
            <Popup>
              Wind {latest.windSpeed.toFixed(1)} m/s, {latest.windDirection} deg
            </Popup>
          </Marker>
        </MapContainer>
      </div>
      <div className="site-facts">
        <label className="map-mode"><input type="checkbox" aria-label="Offline coordinate view" checked={offlineMap} onChange={e => { setOfflineMap(e.target.checked); setTileError(false); }} />Offline coordinate view</label>
        {(offlineMap || tileError) && <p role="status" className="research-warning">{offlineMap ? 'Coordinate view only / no geographic basemap' : 'Map tiles unavailable or incomplete / coordinates and wind markers remain available'}</p>}
        <span>{site.name}</span>
        <strong>{site.asset}</strong>
        <small>
          {site.component} | {position.lat.toFixed(4)}, {position.lon.toFixed(4)} | {site.altitude} m | {position.source}
          {position.accuracy ? ` | +/- ${Math.round(position.accuracy)} m` : ""} | updated {position.updatedAt}
        </small>
        <div className="gps-actions">
          <button className="secondary-action" type="button" onClick={onEnableGps}>
            <MapPin size={15} />
            Use device GPS
          </button>
          {gpsError ? <span className="gps-error">{gpsError}</span> : null}
        </div>
      </div>
    </section>
  );
}

function MapRecenter({ center }: { center: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);

  return null;
}

function TurbinePanel({ latest, serviceState, embedded = false, linked = false, paused = false, onCrackSelect, onRulSelect }: { latest: HistoryPoint; serviceState: ServiceState; embedded?: boolean; linked?: boolean; paused?: boolean; onCrackSelect?: () => void; onRulSelect?: () => void }) {
  const bladesRef = useRef<HTMLDivElement | null>(null);
  const bladeAngleRef = useRef(0);
  const visualVelocityRef = useRef(0);
  const rpmRef = useRef(latest.rpm);
  const serviceModeRef = useRef(latest.serviceMode);
  const pausedAnimationRef = useRef(paused);
  pausedAnimationRef.current = paused;
  const meta = stateMeta[serviceState];
  const crackMm = latest.crackMm ?? 0;
  const severity = clamp(crackMm / 80, 0, 1);
  const crackWidth = severity * 68;
  const crackOpacity = crackMm > 0 ? clamp(0.28 + severity * 0.67, 0, 0.95) : 0;
  const crackLabel = `${latest.crackState ?? "C?"} | ${crackMm.toFixed(1)} mm crack | p10 RUL ${latest.rulP10} pseudo-h`;
  const regime = operatingRegime(latest.windSpeed);
  const serviceAction = latest.serviceAction ? maintenanceActions[latest.serviceAction] : null;
  const serviceLabel =
    latest.serviceMode === "in-downtime"
      ? `${serviceAction?.label ?? "Service"} in downtime (${latest.downtimeH?.toFixed(1) ?? "0"} h)`
      : latest.serviceMode === "post-service"
        ? `${serviceAction?.label ?? "Service"} completed`
        : null;

  useEffect(() => {
    rpmRef.current = latest.rpm;
    serviceModeRef.current = latest.serviceMode;
  }, [latest.rpm, latest.serviceMode]);

  useEffect(() => {
    let frameId = 0;
    let lastTimestamp = performance.now();

    function animateRotor(timestamp: number) {
      const deltaSeconds = Math.min((timestamp - lastTimestamp) / 1000, 0.05);
      lastTimestamp = timestamp;
      if (pausedAnimationRef.current) { frameId = window.requestAnimationFrame(animateRotor); return; }
      const targetVelocity =
        window.matchMedia('(prefers-reduced-motion: reduce)').matches || serviceModeRef.current === "in-downtime" ? 0 : clamp((rpmRef.current / 680) * 560, 0, 720);
      const response = 1 - Math.exp(-deltaSeconds * 3.2);
      visualVelocityRef.current += (targetVelocity - visualVelocityRef.current) * response;
      if (targetVelocity === 0 && visualVelocityRef.current < 0.05) visualVelocityRef.current = 0;
      bladeAngleRef.current = (bladeAngleRef.current + visualVelocityRef.current * deltaSeconds) % 360;

      if (bladesRef.current) {
        bladesRef.current.style.transform = `translate(-50%, -50%) rotate(${bladeAngleRef.current}deg)`;
      }

      frameId = window.requestAnimationFrame(animateRotor);
    }

    frameId = window.requestAnimationFrame(animateRotor);
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  return (
    <section className={`${embedded ? "" : "panel "}turbine-panel ${linked ? "blade-linked" : ""}`} aria-label="Wind turbine physical animation" data-rpm={latest.rpm} data-crack-mm={crackMm} data-rul-p10={latest.rulP10} data-service-mode={latest.serviceMode ?? 'monitoring'}>
      <div className="section-title">
        <Gauge size={18} />
        <h2>WT Operation</h2>
      </div>
      <div className="turbine-stage">
        <div className="mast" />
        <div className="nacelle" />
        <div className="rotor-plane">
          <div className="damage-halo" style={{ opacity: 0.12 + severity * 0.42, borderColor: meta.color }} />
          <div className="blades" ref={bladesRef}>
            <span />
            <span />
            <span />
            <i
              className="crack-slit"
              style={{
                width: `${crackWidth}px`,
                opacity: crackOpacity,
                background: meta.color,
                boxShadow: `0 0 ${6 + severity * 14}px ${meta.color}`
              }}
            />
          </div>
          <div className="hub" style={{ borderColor: meta.color }} />
          {onCrackSelect && <button className="blade-inspect" title="Inspect blade crack evidence" aria-label="Inspect blade crack evidence" onClick={onCrackSelect} />}
        </div>
        <div className="sensor-dot" style={{ background: meta.color }} />
        <div className="crack-readout" style={{ borderColor: meta.color }}>
          <span>Simulated blade condition</span>
          <button onClick={onCrackSelect} aria-label="Open blade condition"><Network size={14} /><strong>{crackLabel}</strong></button>
          <em>{serviceLabel ?? `RUL band ${latest.rulP10}/${latest.rulP50}/${latest.rulP90} pseudo-h`}</em>
        </div>
        <div className="ground-band" />
      </div>
      <div className="operation-strip">
        <span>RPM <strong>{latest.rpm}</strong></span>
        <span>Power <strong>{latest.power} W</strong></span>
        <span>f1 <strong>{latest.modalF1.toFixed(2)} Hz</strong></span>
        <span>Crack <strong>{crackMm.toFixed(1)} mm</strong></span>
        <span>Regime <strong>{regime}</strong></span>
        {onRulSelect && <button onClick={onRulSelect}><Waves size={14} />RUL evidence</button>}
      </div>
      <details className="instrumentation-reference" aria-label="Blade sensor reference">
        <summary><Radio size={14} aria-hidden="true" /><strong>{bladeSensorReference.name}</strong><span>Rig reference / not connected</span></summary>
        <dl>{bladeSensorFields.filter((row) => row.label !== 'Reference sensor').map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}<div><dt>Evidence boundary</dt><dd>{derivedConditionNote}</dd></div></dl>
      </details>
    </section>
  );
}

function DecisionPanel({
  latest,
  serviceState,
  execution,
  autoStats,
  onEvidence
}: {
  latest: HistoryPoint;
  serviceState: ServiceState;
  execution: ServiceExecution | null;
  autoStats: AutoServiceStats;
  onEvidence: () => void;
}) {
  const suggestedAction = suggestedMaintenanceAction(latest, serviceState);
  const meta = stateMeta[serviceState];
  const availability = simulationAvailability(autoStats);
  const energyYield = Math.round(1760 + latest.power * 0.42);
  const settlement = dataset.service?.kpiSettlement;
  const activity = servitizationActivity(latest, serviceState);
  const recommendedTcs = estimateTcs(latest, suggestedAction);
  const recommendedCostGroups = tcsCostGroups(recommendedTcs, latest);
  const autoServiceOptions = serviceCandidatesForState(latest, serviceState).map((action) => estimateTcs(latest, action));
  const tcsAlternatives = (Object.keys(maintenanceActions) as MaintenanceActionKey[])
    .map((action) => estimateTcs(latest, action))
    .sort((a, b) => a.totalCost - b.totalCost);
  const maxTcsCost = Math.max(...tcsAlternatives.map((estimate) => estimate.totalCost), 1);
  const decisionMetrics = [
    { label: "Session availability", value: availability == null ? "Pending" : formatPct(availability), note: `${autoStats.observationHours.toFixed(1)} modeled h / service downtime only` },
    { label: "Crack length", value: `${(latest.crackMm ?? 0).toFixed(1)} mm`, note: `${latest.crackState ?? crackStateFromMm(latest.crackMm ?? 0)} simulated state` },
    { label: "RUL band", value: `${latest.rulP10}/${latest.rulP50}/${latest.rulP90} pseudo-h`, note: "Adjusted lower / P50 / upper" },
    {
      label: "Reference contract",
      value: settlement ? settlement.status : `${energyYield} kWh eq.`,
      note: settlement ? `Chapter 5 / ${formatGbp(settlement.settlement_gbp)}` : "production value"
    },
    { label: "Downtime", value: `${autoStats.totalDowntimeH.toFixed(1)} h`, note: `${autoStats.completedServices} completed services` },
    {
      label: "Residual risk",
      value: recommendedTcs.residualRiskScore.toFixed(2),
      note: `Residual crack ${recommendedTcs.residualCrackMm.toFixed(1)} mm`
    }
  ];

  return (
    <div className="decision-column">
      <section className="panel decision-panel">
      <div className="section-title">
        <ClipboardCheck size={18} />
        <h2>Service Decision</h2>
      </div>
      <div className="decision-command-card" style={{ borderColor: meta.color }}>
        <div className="decision-state">
          <span>Current service-state</span>
          <strong style={{ color: meta.color }}>{serviceState}</strong>
          <p>{meta.kpi}</p>
        </div>
        <div className="decision-selected-action">
          <span>TCS-selected service</span>
          <b>{maintenanceActions[suggestedAction].label}</b>
          <small>{formatGbp(recommendedTcs.totalCost)} | downtime {maintenanceActions[suggestedAction].defaultDowntimeH.toFixed(1)} h</small>
        </div>
      </div>

      <div className="decision-metric-grid">
        {decisionMetrics.map((metric) => (
          <div className="decision-metric" key={metric.label}>
            <span>{metric.label}</span>
            <b>{metric.value}</b>
            <small>{metric.note}</small>
          </div>
        ))}
      </div>

      <button className="primary-action" onClick={onEvidence}>
        <Workflow size={16} />
        Evidence chain
      </button>
    </section>

    <section className="panel tcs-panel" id="tcs-panel">
      <div className="tcs-output">
        <div className="activity-header">
          <ClipboardCheck size={17} />
          <span>Total Cost of Servitization</span>
        </div>
        <div className="tcs-hero">
          <div>
            <span>Single intervention estimate / assumed GBP</span>
            <strong>{formatGbp(recommendedTcs.totalCost)}</strong>
          </div>
          <p>{maintenanceActions[recommendedTcs.action].description}</p>
        </div>
        <div className="tcs-summary-grid">
          {recommendedCostGroups.map((group) => (
            <div className="tcs-cost-card" key={group.label} tabIndex={0}>
              <div className="tcs-cost-card-head">
                <span>{group.label}</span>
                <b>{formatGbp(group.total)}</b>
              </div>
              <ul>
                {group.items.map((item) => (
                  <li key={item.label}>
                    <span>{item.label}</span>
                    <b>{formatCostItemValue(item.value)}</b>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="tcs-alternatives">
          <div className="tcs-table-head">
            <span>Strategy cost comparison</span>
            <b>Total / risk</b>
          </div>
          {tcsAlternatives.map((estimate) => (
            <div className={estimate.action === suggestedAction ? "tcs-option selected" : "tcs-option"} key={estimate.action} tabIndex={0}>
              <div className="tcs-option-row">
                <div className="tcs-option-main">
                  <span>{maintenanceActions[estimate.action].label}</span>
                  <small>
                    downtime {maintenanceActions[estimate.action].defaultDowntimeH.toFixed(1)} h | residual risk {estimate.residualRiskScore.toFixed(2)}
                  </small>
                  <span
                    aria-hidden="true"
                    className="tcs-cost-bar"
                    style={{ width: `${Math.max(6, (estimate.totalCost / maxTcsCost) * 100)}%` }}
                  />
                </div>
                <b>{formatGbp(estimate.totalCost)}</b>
              </div>
              <div className="tcs-breakdown" aria-label={`${maintenanceActions[estimate.action].label} cost breakdown`}>
                {tcsCostGroups(estimate, latest).map((group) => (
                  <div className="tcs-breakdown-group" key={group.label}>
                    <div>
                      <span>{group.label}</span>
                      <b>{formatGbp(group.total)}</b>
                    </div>
                    <ul>
                      {group.items.map((item) => (
                        <li key={item.label}>
                          <span>{item.label}</span>
                          <b>{formatCostItemValue(item.value)}</b>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="panel service-activity-panel">
      <div className="activity-output">
        <div className="activity-header">
          <Wrench size={17} />
          <span>Current Servitization Activity</span>
        </div>
        <strong>{activity.name}</strong>
        <p>{activity.trigger}</p>
        <div className="activity-grid">
          <span>Evidence</span>
          <b>{activity.evidence}</b>
          <span>KPI effect</span>
          <b>{activity.kpiEffect}</b>
          <span>Authority</span>
          <b>{activity.authority}</b>
        </div>
      </div>
    </section>

    <section className="panel auto-service-panel">
      <div className="auto-service-box">
        <div className="activity-header">
          <Wrench size={17} />
          <span>Auto Service Options</span>
        </div>
        <div className="auto-service-list">
          {autoServiceOptions.map((estimate, index) => (
            <div className={estimate.action === suggestedAction ? "auto-service-option selected" : "auto-service-option"} key={estimate.action}>
              <strong>{index + 1}. {maintenanceActions[estimate.action].label}</strong>
              <span>{maintenanceActions[estimate.action].description}</span>
              <small>
                downtime {maintenanceActions[estimate.action].defaultDowntimeH.toFixed(1)} h | TCS {formatGbp(estimate.totalCost)} | residual risk {estimate.residualRiskScore.toFixed(2)}
              </small>
            </div>
          ))}
        </div>
        {execution ? (
          <div className={execution.status === "completed" ? "service-run completed" : "service-run"}>
            <strong>{maintenanceActions[execution.action].label}</strong>
            <span>
              Auto-selected | {execution.status === "in-progress" ? "Downtime in progress" : execution.status === "interrupted" ? "Interrupted" : "Completed"} | {execution.ontology?.progress?.elapsedH.toFixed(1) ?? "0.0"} / {execution.downtimeH.toFixed(1)} h modeled downtime
            </span>
            <small>{execution.note}</small>
          </div>
        ) : null}
      </div>
    </section>
    </div>
  );
}

function EnhancedDashboardModules({
  latest,
  history,
  serviceState,
  execution,
  autoStats,
  events,
  position
}: {
  latest: HistoryPoint;
  history: HistoryPoint[];
  serviceState: ServiceState;
  execution: ServiceExecution | null;
  autoStats: AutoServiceStats;
  events: OntologyExecution[];
  position: LivePosition;
}) {
  const confidence = modelConfidence(latest, history);
  const [qualityClock, setQualityClock] = useState(Date.now);
  useEffect(() => { const timer = window.setInterval(() => setQualityClock(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const qualityRows = dataQualityRows(latest, position, confidence, qualityClock);
  const ledgerRows = serviceLedgerRows(latest, serviceState, events);
  const kpis = cumulativeKpis(latest, autoStats);

  return (
    <section className="enhanced-dashboard" aria-label="Enhanced DT servitization modules">
      <div className="enhanced-title">
        <div className="section-title">
          <Database size={18} />
          <h2>Enhanced DT Servitization Layer</h2>
        </div>
        <p>Model trust, data quality, service history and cumulative KPI evidence.</p>
      </div>

      <div className="enhanced-grid">
        <section className="panel enhanced-panel">
          <div className="activity-header">
            <ShieldCheck size={17} />
            <span>Model Heuristic Scores</span>
          </div>
          <div className="confidence-stack">
            <ConfidenceBar label="Crack evidence score" value={confidence.crackDetection} note={`Anomaly score ${confidence.anomalyScore.toFixed(0)} / 100`} />
            <ConfidenceBar label="RUL stability score" value={confidence.rulConfidence} note={`RUL spread ${latest.rulP90 - latest.rulP10} pseudo-h`} />
            <ConfidenceBar label="Decision support score" value={confidence.decisionConfidence} note={maintenanceActions[serviceDecisionByTcs(latest, serviceState).action].label} />
          </div>
          <details className="model-basis"><summary>Model basis / {modelMetadata.version}</summary><dl>
            <div><dt>Validation</dt><dd>{modelMetadata.scope}; {rulModel.evaluationScope}</dd></div>
            <div><dt>Source</dt><dd>{modelMetadata.basis}</dd></div>
            <div><dt>RUL model</dt><dd>31 features / reg:quantileerror / 300 trees per quantile / depth 6 / learning rate 0.05 / seed 42 / initial prediction 500</dd></div>
            <div><dt>Vibration basis</dt><dd>Charts show X/Y/Z separately. Existing signal thresholds, growth and TCS inputs retain Z RMS/kurtosis; waveform references are not inference inputs.</dd></div>
            <div><dt>Training target</dt><dd>{rulModel.target}; crack length is excluded from the model inputs</dd></div>
            <div><dt>Data split</dt><dd>189 training / 63 calibration / 63 test windows; no final refit on calibration or test rows</dd></div>
            <div><dt>Held-out result</dt><dd>RMSE {rulModel.evaluation.rmse.toFixed(2)} pseudo-h / MAE {rulModel.evaluation.mae.toFixed(2)} pseudo-h / PICP {(rulModel.evaluation.picp * 100).toFixed(1)}% / MPIW {rulModel.evaluation.mpiw.toFixed(2)} pseudo-h</dd></div>
            <div><dt>Same-split baseline</dt><dd>Original RMSE {rulModel.comparison.originalSameSplit.rmse.toFixed(2)} / PICP {(rulModel.comparison.originalSameSplit.picp * 100).toFixed(1)}% / MPIW {rulModel.comparison.originalSameSplit.mpiw.toFixed(2)} pseudo-h; original model files retained</dd></div>
            <div><dt>Interval calibration</dt><dd>Nominal 80% P10/P90-based envelope; outward correction {rulModel.calibration.radius.toFixed(2)} pseudo-h / raw percentiles retained. Adjusted bounds are not exact percentiles.</dd></div>
            <div><dt>Current uncertainty</dt><dd>{rulUncertaintyDescription(latest)}. Repeated source windows do not establish independent-blade validation.</dd></div>
            <div><dt>Current input</dt><dd>{rulDescription(latest)}; {latest.rulEvidence?.outsideTraining.length ?? 0} features outside training range</dd></div>
            <div><dt>Operating envelope</dt><dd>Cut-in {modelMetadata.cutInMs} m/s / {modelMetadata.maxRpm} RPM / {modelMetadata.maxPowerW} W; operating/growth/repair models remain scenario assumptions. Wind direction is context only.</dd></div>
            <div><dt>Scores / policy</dt><dd>Heuristic scores are not accuracy or failure probabilities. Minimum TCS passing the heuristic risk filter; costs and repair effects are assumptions.</dd></div>
          </dl></details>
        </section>

        <section className="panel enhanced-panel">
          <div className="activity-header">
            <Activity size={17} />
            <span>Data Quality and Sensor Health</span>
          </div>
          <div className="quality-list">
            {qualityRows.map((row) => (
              <div className={`quality-row ${row.status}`} key={row.label}>
                <span>{row.label}</span>
                <strong>{row.value}</strong>
                <small>{row.note}</small>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="enhanced-grid wide">
        <section className="panel enhanced-panel">
          <div className="activity-header">
            <ClipboardList size={17} />
            <span>Service History and Work Order Ledger</span>
          </div>
          <div className="ledger-table" role="table" aria-label="Service work order ledger">
            <div className="ledger-head" role="row">
              <span>Time</span>
              <span>Service</span>
              <span>Evidence</span>
              <span>Outcome</span>
            </div>
            {ledgerRows.map((row) => (
              <div className="ledger-row" role="row" key={row.id}>
                <span>{row.time}</span>
                <strong>{row.service}</strong>
                <span>{row.evidence}</span>
                <b>{row.outcome}</b>
              </div>
            ))}
          </div>
        </section>

        <section className="panel enhanced-panel">
          <div className="activity-header">
            <BarChart3 size={17} />
            <span>Session KPI & Chapter 5 References</span>
          </div>
          <div className="kpi-ledger">
            {kpis.map((kpi) => (
              <div key={kpi.label}>
                <span>{kpi.label}</span>
                <strong>{kpi.value}</strong>
                <small>{kpi.note}</small>
              </div>
            ))}
          </div>
        </section>
      </div>

    </section>
  );
}

function ConfidenceBar({ label, value, note }: { label: string; value: number; note: string }) {
  const pct = Math.round(clamp(value, 0, 1) * 100);
  return (
    <div className="confidence-bar">
      <div>
        <span>{label}</span>
        <b>{pct} / 100</b>
      </div>
      <i aria-hidden="true"><em style={{ width: `${pct}%` }} /></i>
      <small>{note}</small>
    </div>
  );
}

function EvidenceModal({
  latest,
  serviceState,
  position,
  onClose
}: {
  latest: HistoryPoint;
  serviceState: ServiceState;
  position: LivePosition;
  onClose: () => void;
}) {
  const meta = stateMeta[serviceState];
  const tcsDecision = serviceDecisionByTcs(latest, serviceState);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Evidence chain">
      <section className="evidence-modal">
        <button className="close-button" onClick={onClose} aria-label="Close evidence chain">
          <X size={18} />
        </button>
        <div className="section-title">
          <Workflow size={18} />
          <h2>Ontology Evidence Chain</h2>
        </div>
        <div className="evidence-chain">
          <EvidenceItem label={`ObservationWindow-${String(latest.acquisitionIndex ?? 421).padStart(4, "0")}`} value={`GPS ${position.lat.toFixed(4)}, ${position.lon.toFixed(4)} | wind ${latest.windSpeed.toFixed(1)} m/s | bin ${latest.windBin ?? "n/a"}`} />
          <EvidenceItem label="FeatureVector" value={`Z RMS ${latest.vibrationRms.toFixed(3)} g | Z kurtosis ${latest.kurtosis.toFixed(2)} | f1 ${latest.modalF1.toFixed(2)} Hz | crack ${latest.crackState ?? "n/a"} ${latest.crackMm ?? 0} mm | growth ${latest.crackGrowthRateMmH?.toFixed(2) ?? "n/a"} mm/tick`} />
          <EvidenceItem label="RULEstimate" value={`p10 ${latest.rulP10} pseudo-h | p50 ${latest.rulP50} pseudo-h | p90 ${latest.rulP90} pseudo-h`} />
          <EvidenceItem label="ServiceState" value={serviceState} accent={meta.color} />
          <EvidenceItem label="ServiceActionRecommendation" value={`${maintenanceActions[tcsDecision.action].label} | TCS ${formatGbp(tcsDecision.totalCost)} | residual risk ${tcsDecision.residualRiskScore.toFixed(2)}`} />
          <EvidenceItem label="ContractKPI" value={meta.kpi} />
        </div>
      </section>
    </div>
  );
}

function EvidenceItem({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="evidence-item">
      <span>{label}</span>
      <strong style={{ color: accent }}>{value}</strong>
    </div>
  );
}

function ScenarioInputModal({
  latest,
  position,
  onClose,
  onApply
}: {
  latest: HistoryPoint;
  position: LivePosition;
  onClose: () => void;
  onApply: (point: HistoryPoint) => void;
}) {
  const [form, setForm] = useState<ScenarioForm>({
    lat: position.lat,
    lon: position.lon,
    windSpeed: latest.windSpeed,
    windDirection: latest.windDirection,
    rpm: latest.rpm,
    power: latest.power,
    vibrationRms: latest.vibrationRms,
    kurtosis: latest.kurtosis,
    modalF1: latest.modalF1,
    crackMm: latest.crackMm ?? 0,
    rulP10: latest.rulP10,
    rulP50: latest.rulP50,
    rulP90: latest.rulP90
  });
  const [touched, setTouched] = useState<Partial<Record<keyof ScenarioForm, true>>>({});
  const [featureWindow, setFeatureWindow] = useState<number[] | null>(latest.rulEvidence?.featureSource === 'imported-window' && latest.rulFeatureVector ? [...latest.rulFeatureVector] : null);
  const [featureError, setFeatureError] = useState<string | null>(null);

  const previewPoint = pointFromScenarioForm(form, featureWindow, touched);
  const previewState = serviceStateFromCondition(previewPoint);
  const previewMeta = stateMeta[previewState];
  const previewActivity = servitizationActivity(previewPoint, previewState);
  const touchedCount = Object.keys(touched).length;
  const conflicts = [...inputRangeErrors(form), ...(featureWindow ? [] : scenarioConflicts(form, touched)), ...(featureError ? [featureError] : [])];

  function updateNumber(key: keyof ScenarioForm, value: string) {
    const parsed = Number(value);
    const nextValue = Number.isFinite(parsed) ? parsed : 0;
    const retainWindow = !!featureWindow && ['lat', 'lon', 'windDirection'].includes(key);
    if (!retainWindow) setFeatureWindow(null);
    setFeatureError(null);
    const nextTouched = { ...touched, [key]: true };
    setTouched(nextTouched);
    setForm((current) => {
      const rawNext = { ...current, [key]: nextValue };
      return retainWindow ? rawNext : applyScenarioModel(rawNext, nextTouched);
    });
  }

  async function importFeatureWindow(file?: File) {
    if (!file) return;
    try {
      if (file.size > 100_000) throw new Error('Feature window exceeds 100 KB.');
      const values = readFeatureWindow(await file.text());
      const measurements = featureMeasurements(values);
      const prediction = predictRul(values, 'imported-window');
      setForm((current) => ({ ...current, ...measurements, ...operatingOutput(measurements.windSpeed), rpm: measurements.rpm, rulP10: prediction.rulP10, rulP50: prediction.rulP50, rulP90: prediction.rulP90 }));
      setFeatureWindow(values); setTouched({}); setFeatureError(null);
    } catch (error) { setFeatureError(error instanceof Error ? error.message : 'Invalid feature window'); }
  }

  function downloadFeatureWindow() {
    const values = featureWindow ?? expectedScenarioValues(form, touched).rulFeatureVector;
    const blob = new Blob([JSON.stringify({ features: Object.fromEntries(rulModel.featureNames.map((name, i) => [name, values[i]])) }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'chapter5-feature-window.json'; link.click(); URL.revokeObjectURL(url);
  }

  function submit() {
    if (conflicts.length > 0) return;
    onApply(previewPoint);
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Input WT scenario data">
      <section className="input-modal">
        <button className="close-button" onClick={onClose} aria-label="Close input window">
          <X size={18} />
        </button>
        <div className="section-title">
          <SlidersHorizontal size={18} />
          <h2>WT Data Input and Servitization Result</h2>
        </div>
        <p className="input-caption">
          Enter a WT condition snapshot. Untouched dependent fields are auto-adjusted by the scenario model; manually edited fields are checked for consistency.
        </p>

        <div className="input-grid">
          <NumberField label="GPS latitude" value={form.lat} step="0.0001" onChange={(value) => updateNumber("lat", value)} />
          <NumberField label="GPS longitude" value={form.lon} step="0.0001" onChange={(value) => updateNumber("lon", value)} />
          <NumberField label="Wind speed m/s" value={form.windSpeed} step="0.1" onChange={(value) => updateNumber("windSpeed", value)} />
          <NumberField label="Wind direction deg" value={form.windDirection} step="1" onChange={(value) => updateNumber("windDirection", value)} />
          <NumberField label="Rotor RPM" value={form.rpm} step="1" onChange={(value) => updateNumber("rpm", value)} />
          <NumberField label="Power W" value={form.power} step="1" onChange={(value) => updateNumber("power", value)} />
          <NumberField label="Blade vibration Z RMS g" value={form.vibrationRms} step="0.001" onChange={(value) => updateNumber("vibrationRms", value)} />
          <NumberField label="Z kurtosis" value={form.kurtosis} step="0.01" onChange={(value) => updateNumber("kurtosis", value)} />
          <NumberField label="Modal f1 Hz" value={form.modalF1} step="0.01" onChange={(value) => updateNumber("modalF1", value)} />
          <NumberField label="Crack length mm" value={form.crackMm} step="1" onChange={(value) => updateNumber("crackMm", value)} />
          <NumberField label="RUL lower / pseudo-h" value={form.rulP10} step="1" onChange={(value) => updateNumber("rulP10", value)} />
          <NumberField label="RUL P50 / pseudo-h" value={form.rulP50} step="1" onChange={(value) => updateNumber("rulP50", value)} />
          <NumberField label="RUL upper / pseudo-h" value={form.rulP90} step="1" onChange={(value) => updateNumber("rulP90", value)} />
        </div>

        <details className="feature-window-input"><summary>Chapter 5 XGBoost feature window</summary><div className="feature-window-tools"><label><Upload size={14} />Feature JSON<input type="file" accept=".json,application/json" aria-label="Import Chapter 5 feature window" onChange={(event) => { void importFeatureWindow(event.target.files?.[0]); event.target.value = ''; }} /></label><button type="button" title="Download current named feature window" onClick={downloadFeatureWindow}><Download size={14} />Feature window</button></div><dl><div><dt>Input source</dt><dd>{rulDescription(previewPoint)}</dd></div><div><dt>Feature coverage</dt><dd>{featureWindow ? '31 / 31 provided' : '31 / 31 reference-assisted; not measured'}</dd></div><div><dt>Training domain</dt><dd>{previewPoint.rulEvidence?.outsideTraining.length ?? 0} features outside training range</dd></div><div><dt>Prediction scope</dt><dd>Synthetic pseudo-hours / {rulUncertaintyDescription(previewPoint)}</dd></div></dl></details>

        <div className="scenario-result" style={{ borderColor: previewMeta.color, background: previewMeta.bg }}>
          <span>Servitization output preview</span>
          <strong style={{ color: previewMeta.color }}>{previewState}</strong>
          <p>{previewActivity.name}</p>
          <small>
            {previewActivity.kpiEffect} Operating regime: {operatingRegime(form.windSpeed)}. Wind-speed edits auto-couple RPM, power, vibration and RUL stress.
          </small>
        </div>

        <div className={conflicts.length > 0 ? "model-check has-errors" : "model-check"}>
          <span>Model consistency check</span>
          {conflicts.length > 0 ? (
            <ul>
              {conflicts.map((conflict) => (
                <li key={conflict}>{conflict}</li>
              ))}
            </ul>
          ) : (
            <p>{touchedCount > 0 ? "Input bounds and edited parameter relationships passed." : "No scenario edits."}</p>
          )}
        </div>

        <div className="modal-actions">
          <button className="secondary-action" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-action compact" type="button" onClick={submit} disabled={conflicts.length > 0}>
            Apply to dashboard
          </button>
        </div>
      </section>
    </div>
  );
}

function NumberField({ label, value, step, onChange }: { label: string; value: number; step: string; onChange: (value: string) => void }) {
  return (
    <label className="number-field">
      <span>{label}</span>
      <input type="number" value={value} step={step} min={Object.values(inputBounds).find((bound) => label.startsWith(bound.label))?.min} max={Object.values(inputBounds).find((bound) => label.startsWith(bound.label))?.max} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function pointFromScenarioForm(form: ScenarioForm, featureWindow: number[] | null = null, touched: Partial<Record<keyof ScenarioForm, true>> = {}): HistoryPoint {
  const crackMm = clamp(form.crackMm, 0, 80);
  const crackState = crackStateFromMm(crackMm);
  const prediction = featureWindow ? { ...predictRul(featureWindow, 'imported-window'), rulFeatureVector: featureWindow } : expectedScenarioValues(form, touched);
  const manualRul = !featureWindow && (['rulP10', 'rulP50', 'rulP90'] as const).some((key) => touched[key] || Math.round(form[key]) !== prediction[key]);
  const point = {
    t: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    acquisitionIndex: 9999,
    source: "manual-input",
    modelVersion: modelMetadata.version,
    rulEvidence: { ...prediction.rulEvidence, featureSource: manualRul ? 'manual-override' as const : prediction.rulEvidence.featureSource, intervalCalibration: manualRul ? undefined : prediction.rulEvidence.intervalCalibration },
    rulFeatureVector: prediction.rulFeatureVector,
    observedAt: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
    lat: form.lat,
    lon: form.lon,
    windSpeed: Number(clamp(form.windSpeed, 0, 40).toFixed(2)),
    windDirection: Math.round(((form.windDirection % 360) + 360) % 360),
    rpm: Math.round(clamp(form.rpm, 0, 1200)),
    power: Math.round(clamp(form.power, 0, 800)),
    vibrationRms: Number(clamp(form.vibrationRms, 0, 1).toFixed(4)),
    kurtosis: Number(clamp(form.kurtosis, 0, 30).toFixed(2)),
    modalF1: Number(clamp(form.modalF1, 0, 80).toFixed(2)),
    crackState,
    crackMm,
    windBin: windBinFromSpeed(form.windSpeed),
    rulP10: Math.round(Math.max(0, form.rulP10)),
    rulP50: Math.round(Math.max(0, form.rulP50)),
    rulP90: Math.round(Math.max(0, form.rulP90))
  };

  return { ...point, serviceState: serviceStateFromCondition(point) };
}

function simulateAutoTwinPoint(base: HistoryPoint, prior: HistoryPoint | undefined, index: number, useReplayObservation: boolean): HistoryPoint {
  const observedCrack = base.crackMm ?? inferCrackFromRul(base.rulP10);
  const priorCrack = prior?.crackMm ?? observedCrack;
  const growthRate = crackGrowthRate(base, priorCrack, index);
  const crackMm = Number(clamp(useReplayObservation ? Math.max(observedCrack, priorCrack + growthRate) : priorCrack + growthRate, 0, 80).toFixed(1));
  const prediction = conditionPrediction(base.windSpeed, crackMm);
  const point: HistoryPoint = {
    ...base,
    source: "auto-simulation",
    modelVersion: modelMetadata.version,
    observedAt: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
    ...operatingOutput(base.windSpeed),
    ...prediction,
    crackMm,
    crackState: crackStateFromMm(crackMm),
    crackGrowthRateMmH: Number(growthRate.toFixed(2)),
    windBin: windBinFromSpeed(base.windSpeed),
    serviceMode: undefined,
    serviceAction: undefined,
    downtimeH: undefined,
    serviceNote: `Simulated crack growth: +${growthRate.toFixed(2)} mm/tick, RUL recalculated from crack and wind load.`
  };

  return { ...point, serviceState: serviceStateFromCondition(point) };
}

function inferCrackFromRul(rulP10: number) {
  return Number(clamp((1 - clamp(rulP10, 0, 900) / 900) * 72, 0, 80).toFixed(1));
}

function automaticMaintenanceAction(point: HistoryPoint): MaintenanceActionKey | null {
  const serviceState = point.serviceState ?? serviceStateFromCondition(point);
  const crackMm = point.crackMm ?? 0;
  const decision = serviceDecisionByTcs(point, serviceState);

  if (decision.action === "condition-inspection" || decision.action === "spare-prepositioning") return null;
  if (crackMm >= 45 || point.rulP10 < 360 || decision.residualRiskScore > 0.42) return decision.action;
  return null;
}

function downtimeTicksFromHours(downtimeH: number) {
  return Math.max(2, Math.min(8, Math.ceil(downtimeH / 3)));
}

function makeDowntimePoint(point: HistoryPoint, runtime: AutoServiceRuntime): HistoryPoint {
  return {
    ...point,
    t: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    source: "auto-service",
    observedAt: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
    rpm: 0,
    power: 0,
    serviceMode: "in-downtime",
    serviceAction: runtime.action,
    downtimeH: runtime.downtimeH,
    elapsedDowntimeH: Number((runtime.downtimeH * (runtime.totalTicks - runtime.ticksRemaining) / runtime.totalTicks).toFixed(6)),
    serviceState: "MaintenanceDue",
    serviceNote: `Auto ${maintenanceActions[runtime.action].label} in progress; planned downtime ${runtime.downtimeH.toFixed(1)} h.`
  };
}

function suggestedMaintenanceAction(point: HistoryPoint, serviceState: ServiceState): MaintenanceActionKey {
  return serviceDecisionByTcs(point, serviceState).action;
}

function tcsCostGroups(estimate: ServiceCostEstimate, point: HistoryPoint) {
  const actionConfig = maintenanceActions[estimate.action];
  const economics = serviceEconomics[estimate.action];
  const downtimeH = actionConfig.defaultDowntimeH;
  const downtimeOperatingCost = Math.round(downtimeH * tcsParameters.downtimeCostPerHour);
  const lostGenerationCost = estimate.downtimeCost - downtimeOperatingCost;
  const contractBase = Math.round(downtimeH * tcsParameters.availabilityPenaltyPerHour);
  const contractUplift = estimate.contractCost - contractBase;
  const logisticsGross = economics.logisticsCost;
  const planningCredit = economics.planningCredit;

  return [
    {
      label: "Service",
      total: estimate.directCost,
      items: serviceDirectCostItems(estimate.action, estimate.directCost)
    },
    {
      label: "Downtime",
      total: estimate.downtimeCost,
      items: [
        { label: `${downtimeH.toFixed(1)} h service window`, value: downtimeOperatingCost },
        { label: `${point.power} W lost generation`, value: lostGenerationCost }
      ]
    },
    {
      label: "Logistics",
      total: estimate.logisticsCost,
      items: [
        { label: "Mobilisation and travel", value: Math.round(logisticsGross * 0.55) },
        { label: "Spare slot / tooling reserve", value: Math.round(logisticsGross * 0.45) },
        ...(planningCredit > 0 ? [{ label: "Planning credit", value: -planningCredit }] : [])
      ]
    },
    {
      label: "Contract",
      total: estimate.contractCost,
      items: [
        { label: "Availability exposure", value: contractBase },
        ...(contractUplift > 0 ? [{ label: "Low-RUL penalty uplift", value: contractUplift }] : [])
      ]
    },
    {
      label: "Residual risk",
      total: estimate.residualRiskCost,
      items: residualRiskCostItems(estimate, point)
    }
  ];
}

function serviceDirectCostItems(action: MaintenanceActionKey, total: number) {
  if (action === "condition-inspection") {
    return splitCost(total, [
      ["NDT inspection labour", 0.62],
      ["Sensor review and report", 0.38]
    ]);
  }

  if (action === "spare-prepositioning") {
    return splitCost(total, [
      ["Supplier reservation", 0.7],
      ["Procurement handling", 0.3]
    ]);
  }

  if (action === "corrective-maintenance") {
    return splitCost(total, [
      ["Blade replacement kit", 0.58],
      ["Emergency repair labour", 0.28],
      ["Post-repair validation", 0.14]
    ]);
  }

  return splitCost(total, [
    ["Blade repair material", 0.45],
    ["Technician labour", 0.35],
    ["Calibration and validation", 0.2]
  ]);
}

function splitCost(total: number, specs: Array<[string, number]>) {
  let allocated = 0;
  return specs.map(([label, weight], index) => {
    const value = index === specs.length - 1 ? total - allocated : Math.round(total * weight);
    allocated += value;
    return { label, value };
  });
}

function residualRiskCostItems(estimate: ServiceCostEstimate, point: HistoryPoint) {
  const crackDriver = clamp(estimate.residualCrackMm / 80, 0, 1) * 0.48;
  const rulDriver = clamp(1 - estimate.residualRulP10 / 900, 0, 1) * 0.32;
  const vibrationDriver = clamp((point.vibrationRms - 0.04) / 0.18, 0, 1) * 0.13;
  const loadDriver = clamp((point.windSpeed - 7) / 7, 0, 1) * 0.07;
  const totalDriver = crackDriver + rulDriver + vibrationDriver + loadDriver || 1;

  return splitCost(estimate.residualRiskCost, [
    [`Crack exposure ${estimate.residualCrackMm.toFixed(1)} mm`, crackDriver / totalDriver],
    [`Lower RUL exposure ${estimate.residualRulP10} pseudo-h`, rulDriver / totalDriver],
    ["Vibration/load uncertainty", (vibrationDriver + loadDriver) / totalDriver]
  ]);
}

function formatCostItemValue(value: number) {
  if (Math.round(value) === 0) return "Low";
  if (value < 0) return `-GBP ${Math.round(Math.abs(value)).toLocaleString("en-GB")}`;
  return formatGbp(value);
}

function formatGbp(value: number) {
  return `GBP ${Math.round(value).toLocaleString("en-GB")}`;
}

function formatPct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function modelConfidence(latest: HistoryPoint, history: HistoryPoint[]) {
  const crackMm = latest.crackMm ?? 0;
  const crackFactor = clamp(crackMm / 80, 0, 1);
  const vibrationSignal = clamp((latest.vibrationRms - 0.035) / 0.16, 0, 1);
  const kurtosisSignal = clamp((latest.kurtosis - 2.7) / 6.8, 0, 1);
  const modalSignal = clamp((27.55 - latest.modalF1) / 7, 0, 1);
  const windPenalty = latest.windSpeed > 11 ? 0.08 : latest.windSpeed > 8 ? 0.04 : 0;
  const rulSpread = Math.max(0, latest.rulP90 - latest.rulP10);
  const recentRul = history.slice(-8).map((point) => point.rulP50);
  const rulSwing = recentRul.length > 1 ? Math.max(...recentRul) - Math.min(...recentRul) : 0;
  const anomalyScore = clamp((crackFactor * 0.46 + vibrationSignal * 0.24 + kurtosisSignal * 0.2 + modalSignal * 0.1) * 100, 0, 100);
  const crackDetection = clamp(0.66 + crackFactor * 0.18 + vibrationSignal * 0.1 + kurtosisSignal * 0.08 - windPenalty, 0.58, 0.98);
  const rulConfidence = clamp(1 - rulSpread / 940 - rulSwing / 1200, 0.42, 0.94);
  const tcsDecision = serviceDecisionByTcs(latest, latest.serviceState ?? serviceStateFromCondition(latest));
  const decisionConfidence = clamp(crackDetection * 0.42 + rulConfidence * 0.34 + (1 - tcsDecision.residualRiskScore) * 0.24, 0.5, 0.98);

  return {
    crackDetection,
    rulConfidence,
    decisionConfidence,
    anomalyScore
  };
}

function dataQualityRows(latest: HistoryPoint, position: LivePosition, confidence: ReturnType<typeof modelConfidence>, now = Date.now()) {
  const vc1 = dataset.service?.validationConditions?.VC1_latency;
  const vc2 = dataset.service?.validationConditions?.VC2_provenance;
  const rows = [
    {
      label: "GPS context",
      value: `${position.lat.toFixed(4)}, ${position.lon.toFixed(4)}`,
      note: `${position.source}${position.accuracy ? `, accuracy ${position.accuracy.toFixed(0)} m` : ""}`,
      status: position.source !== "Device GPS" ? "context" : position.accuracy == null || position.accuracy > 50 ? "warn" : "pass"
    },
    {
      label: "Telemetry freshness",
      ...readingFreshness(latest, now)
    },
    {
      label: "Z vibration feature quality",
      value: `${latest.vibrationRms.toFixed(3)} g / k ${latest.kurtosis.toFixed(2)}`,
      note: confidence.anomalyScore > 65 ? "High anomaly content; service layer should preserve raw evidence." : "Signal within expected model range.",
      status: latest.vibrationRms > 0.26 || latest.kurtosis > 10 ? "warn" : "pass"
    },
    {
      label: "RUL interval logic",
      value: `${latest.rulP10}/${latest.rulP50}/${latest.rulP90} pseudo-h`,
      note: latest.rulP10 <= latest.rulP50 && latest.rulP50 <= latest.rulP90 ? "p10 <= p50 <= p90" : "RUL bounds conflict.",
      status: latest.rulP10 <= latest.rulP50 && latest.rulP50 <= latest.rulP90 ? "pass" : "warn"
    },
    {
      label: "XGBoost input domain",
      value: rulDescription(latest),
      note: latest.rulEvidence?.outsideTraining.length ? `${latest.rulEvidence.outsideTraining.length} features outside training range; field generalisation not validated` : 'Controlled synthetic training domain; reference-assisted values are not measurements',
      status: latest.rulEvidence?.outsideTraining.length ? "warn" : "context"
    },
    {
      label: "RUL interval scope",
      value: `${latest.rulP90 - latest.rulP10} pseudo-h width`,
      note: rulUncertaintyDescription(latest),
      status: latest.rulP90 - latest.rulP10 > 600 ? "warn" : "context"
    },
    {
      label: "Chapter 5 latency reference",
      value: vc1 ? `${vc1.p95_ms.toFixed(1)} ms p95` : "n/a",
      note: "Recorded VC1 result; not a current latency measurement",
      status: "context"
    },
    {
      label: "Chapter 5 provenance reference",
      value: vc2 ? `${vc2.audit_rate_pct.toFixed(0)}% audit` : "n/a",
      note: "Recorded VC2 reference; WT snapshot validation is separately executed",
      status: "context"
    }
  ];

  return rows;
}

function serviceLedgerRows(
  latest: HistoryPoint,
  serviceState: ServiceState,
  events: OntologyExecution[]
) {
  const decision = serviceDecisionByTcs(latest, serviceState);
  const rows = [
    {
      id: "current-advisory",
      time: latest.t,
      service: maintenanceActions[decision.action].label,
      evidence: `${latest.crackState ?? "C?"} ${latest.crackMm?.toFixed(1) ?? "0.0"} mm, p10 ${latest.rulP10} pseudo-h`,
      outcome: `Advisory TCS ${formatGbp(decision.totalCost)}`
    }
  ];

  for (const event of events.slice(0, 3)) {
    rows.push({
      id: event.id,
      time: event.after?.reading.t ?? event.during?.[event.during.length - 1]?.reading.t ?? event.before.reading.t,
      service: event.label,
      evidence: `${event.progress?.elapsedH.toFixed(1) ?? "0.0"} / ${event.downtimeH} h, ${event.status}`,
      outcome: event.endReason ?? (event.after ? `${event.before.reading.crackMm?.toFixed(1)} -> ${event.after.reading.crackMm?.toFixed(1)} mm / simulated outcome` : "Automatic demo policy / measured assessment pending")
    });
  }

  rows.push({
    id: "next-advisory",
    time: "Next",
    service: serviceState === "Nominal" || serviceState === "Watch" ? "Continue monitoring" : "Planner review",
    evidence: `Residual risk ${decision.residualRiskScore.toFixed(2)}, residual crack ${decision.residualCrackMm.toFixed(1)} mm`,
    outcome: serviceState === "MaintenanceDue" || serviceState === "Critical" ? "Dispatch window required" : "No immediate downtime"
  });

  return rows.slice(0, 4);
}

function cumulativeKpis(latest: HistoryPoint, autoStats: AutoServiceStats) {
  const vc3 = dataset.service?.validationConditions?.VC3_delta_availability;
  const settlement = dataset.service?.kpiSettlement;
  const currentDecision = serviceDecisionByTcs(latest, latest.serviceState ?? serviceStateFromCondition(latest));
  const currentAvailability = simulationAvailability(autoStats);

  return [
    {
      label: "Session availability",
      value: currentAvailability == null ? "Pending" : formatPct(currentAvailability),
      note: `${autoStats.observationHours.toFixed(1)} modeled h; includes partial interrupted downtime, excludes held manual scenarios`
    },
    {
      label: "Avoided downtime",
      value: "Not estimated",
      note: "No matched counterfactual for the current simulation window"
    },
    {
      label: "Chapter 5 availability reference",
      value: settlement ? formatPct(settlement.actual_availability) : "Unavailable",
      note: vc3 && settlement ? `Reference baseline ${formatPct(vc3.baseline_availability)}, delta ${((settlement.actual_availability - vc3.baseline_availability) * 100).toFixed(1)} pp / ${dataset.service?.availability?.total_hours ?? "n/a"} h source window` : "Fixed dataset reference"
    },
    {
      label: "Chapter 5 settlement reference",
      value: settlement ? `${settlement.status} ${formatGbp(settlement.settlement_gbp)}` : "Pending",
      note: settlement ? `Reference target ${formatPct(settlement.contractual_target)}, actual ${formatPct(settlement.actual_availability)}; not a session settlement` : "No settlement source"
    },
    {
      label: "Current TCS exposure",
      value: formatGbp(currentDecision.totalCost),
      note: `${maintenanceActions[currentDecision.action].label}, residual risk ${currentDecision.residualRiskScore.toFixed(2)}`
    },
    {
      label: "Closed-loop services",
      value: String(autoStats.completedServices),
      note: `${autoStats.totalDowntimeH.toFixed(1)} h downtime accumulated`
    }
  ];
}

function ontologySnapshot(latest: HistoryPoint, position: LivePosition, id: string): OntologySnapshot {
  const serviceState = latest.serviceState ?? serviceStateFromCondition(latest);
  const decision = serviceDecisionByTcs(latest, serviceState);
  const candidates = serviceCandidatesForState(latest, serviceState).map((action) => {
    const estimate = estimateTcs(latest, action);
    return {
      action,
      label: maintenanceActions[action].label,
      type: actionTypes[action],
      totalCost: estimate.totalCost,
      residualRiskScore: estimate.residualRiskScore,
      acceptable: isRiskAcceptableAfterAction(latest, estimate, serviceState),
      costs: tcsCostGroups(estimate, latest).map((group) => ({ label: group.label, value: group.total }))
    };
  });
  const settlement = dataset.service?.kpiSettlement;
  return {
    id,
    capturedAt: new Date().toISOString(),
    reading: { ...latest },
    asset: site.asset,
    component: site.component,
    serviceState,
    position: { lat: position.lat, lon: position.lon, source: position.source },
    candidates,
    recommendation: candidates.find((candidate) => candidate.action === decision.action)!,
    selectionBasis: "Minimum estimated TCS among candidates passing the existing residual-risk policy; minimum-cost fallback if none pass.",
    contract: settlement ? { actual: settlement.actual_availability, target: settlement.contractual_target, status: settlement.status } : null
  };
}

function applyMaintenanceResult(current: HistoryPoint, action: MaintenanceActionKey, downtimeH: number): HistoryPoint {
  const actionConfig = maintenanceActions[action];
  const crackBefore = current.crackMm ?? 0;
  const crackAfter = Number(clamp(crackBefore * (1 - actionConfig.crackReduction), 0, 80).toFixed(1));
  const prediction = crackAfter === crackBefore ? { vibrationRms: current.vibrationRms, kurtosis: current.kurtosis, modalF1: current.modalF1, rulP10: current.rulP10, rulP50: current.rulP50, rulP90: current.rulP90, rulEvidence: current.rulEvidence, rulFeatureVector: current.rulFeatureVector } : conditionPrediction(current.windSpeed, crackAfter);

  const point: HistoryPoint = {
    ...current,
    t: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    source: "service-action",
    modelVersion: crackAfter === crackBefore ? current.modelVersion : modelMetadata.version,
    observedAt: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
    ...operatingOutput(current.windSpeed),
    ...prediction,
    crackMm: crackAfter,
    crackState: crackStateFromMm(crackAfter),
    windBin: windBinFromSpeed(current.windSpeed),
    serviceMode: "post-service",
    serviceAction: action,
    downtimeH,
    serviceNote: `${actionConfig.label} completed: crack ${crackBefore.toFixed(1)} mm -> ${crackAfter.toFixed(1)} mm, RUL p50 -> ${prediction.rulP50} pseudo-h`
  };

  return { ...point, serviceState: serviceStateFromCondition(point) };
}

function applyScenarioModel(form: ScenarioForm, touched: Partial<Record<keyof ScenarioForm, true>>): ScenarioForm {
  const expected = expectedScenarioValues(form, touched);
  const next = { ...form };
  const autoFields: Array<keyof Pick<ScenarioForm, "rpm" | "power" | "vibrationRms" | "kurtosis" | "modalF1" | "rulP10" | "rulP50" | "rulP90">> = [
    "rpm",
    "power",
    "vibrationRms",
    "kurtosis",
    "modalF1",
    "rulP10",
    "rulP50",
    "rulP90"
  ];

  for (const field of autoFields) {
    if (!touched[field]) {
      next[field] = expected[field];
    }
  }

  if (!touched.rulP10 && touched.rulP50) next.rulP10 = Math.max(0, Math.round(next.rulP50 - expected.rulSpread));
  if (!touched.rulP90 && touched.rulP50) next.rulP90 = Math.min(1200, Math.max(0, Math.round(next.rulP50 + expected.rulUpperSpread)));

  return next;
}

function expectedScenarioValues(form: ScenarioForm, touched: Partial<Record<keyof ScenarioForm, true>> = {}) {
  const overrides = { vibrationRms: touched.vibrationRms ? form.vibrationRms : undefined, kurtosis: touched.kurtosis ? form.kurtosis : undefined, modalF1: touched.modalF1 ? form.modalF1 : undefined, rpm: touched.rpm ? form.rpm : undefined };
  return { ...operatingOutput(form.windSpeed), ...conditionPrediction(form.windSpeed, form.crackMm, overrides) };
}

function scenarioConflicts(form: ScenarioForm, touched: Partial<Record<keyof ScenarioForm, true>>) {
  const expected = expectedScenarioValues(form);
  const conflicts: string[] = [];
  const manuallySet = (a: keyof ScenarioForm, b: keyof ScenarioForm) => touched[a] && touched[b];

  if (form.windSpeed < modelMetadata.cutInMs && (form.rpm !== 0 || form.power !== 0)) conflicts.push("Below cut-in wind requires zero RPM and power in this model.");

  if (form.rulP10 > form.rulP50 || form.rulP50 > form.rulP90) {
    conflicts.push("RUL bounds conflict: p10 must be <= p50 <= p90.");
  }

  if (manuallySet("windSpeed", "rpm") && outsideRelativeTolerance(form.rpm, expected.rpm, 0.28, 55)) {
    conflicts.push(`Wind speed and RPM conflict: ${form.windSpeed.toFixed(1)} m/s implies roughly ${expected.rpm} RPM, not ${Math.round(form.rpm)} RPM.`);
  }

  if (manuallySet("windSpeed", "power") && outsideRelativeTolerance(form.power, expected.power, 0.38, 45)) {
    conflicts.push(`Wind speed and power conflict: ${form.windSpeed.toFixed(1)} m/s implies roughly ${expected.power} W, not ${Math.round(form.power)} W.`);
  }

  if ((touched.windSpeed || touched.crackMm) && touched.vibrationRms && Math.abs(form.vibrationRms - expected.vibrationRms) > 0.045) {
    conflicts.push(`Wind/crack and vibration conflict: expected RMS is about ${expected.vibrationRms.toFixed(3)} g, not ${form.vibrationRms.toFixed(3)} g.`);
  }

  if (manuallySet("crackMm", "modalF1") && Math.abs(form.modalF1 - expected.modalF1) > 1.8) {
    conflicts.push(`Crack length and modal f1 conflict: ${form.crackMm.toFixed(0)} mm crack implies f1 near ${expected.modalF1.toFixed(2)} Hz.`);
  }

  if ((touched.crackMm || touched.windSpeed) && touched.rulP10 && Math.abs(form.rulP10 - expected.rulP10) > 220) {
    conflicts.push(`Damage/load and RUL conflict: expected p10 RUL is about ${expected.rulP10} pseudo-h, not ${Math.round(form.rulP10)} pseudo-h.`);
  }

  return conflicts;
}

function outsideRelativeTolerance(actual: number, expected: number, relativeTolerance: number, absoluteTolerance: number) {
  return Math.abs(actual - expected) > Math.max(Math.abs(expected) * relativeTolerance, absoluteTolerance);
}


function crackStateFromMm(crackMm: number) {
  if (crackMm >= 80) return "C6";
  if (crackMm >= 60) return "C5";
  if (crackMm >= 45) return "C4";
  if (crackMm >= 30) return "C3";
  if (crackMm >= 20) return "C2";
  if (crackMm >= 10) return "C1";
  return "C0";
}

function windBinFromSpeed(windSpeed: number) {
  if (windSpeed < 5) return "low";
  if (windSpeed < 7) return "mid";
  return "high";
}

function operatingRegime(windSpeed: number) {
  if (windSpeed < 3) return "Below cut-in";
  if (windSpeed < 7) return "Normal";
  if (windSpeed < 11) return "High load";
  return "Gust stress";
}

function servitizationActivity(latest: HistoryPoint, serviceState: ServiceState) {
  const growthEvidence = latest.crackGrowthRateMmH != null ? `, crack growth +${latest.crackGrowthRateMmH.toFixed(2)} mm/tick` : "";
  const baseEvidence = `${latest.crackState ?? "C?"}, ${operatingRegime(latest.windSpeed)}, p10 RUL ${latest.rulP10} pseudo-h, RMS ${latest.vibrationRms.toFixed(3)} g${growthEvidence}`;
  const tcsDecision = serviceDecisionByTcs(latest, serviceState);
  const tcsEvidence = `${maintenanceActions[tcsDecision.action].label}, TCS ${formatGbp(tcsDecision.totalCost)}, residual risk ${tcsDecision.residualRiskScore.toFixed(2)}`;

  if (serviceState === "Nominal") {
    return {
      name: "Performance reporting and normal monitoring",
      trigger: "The asset remains inside the contractual operating envelope.",
      evidence: `${baseEvidence}; ${tcsEvidence}`,
      kpiEffect: "TCS remains below the intervention threshold, so availability evidence is accumulated for reporting.",
      authority: "Automated reporting"
    };
  }

  if (serviceState === "Watch") {
    return {
      name: "Enhanced monitoring and non-intrusive inspection",
      trigger: "Early crack class entered; the service layer increases observation density while the WT remains operational.",
      evidence: `${baseEvidence}; ${tcsEvidence}`,
      kpiEffect: "TCS favours monitoring over downtime because residual risk is still cheaper than stopping production.",
      authority: "Service planner review"
    };
  }

  if (serviceState === "Degraded") {
    return {
      name: "Maintenance-window planning and spare preparation",
      trigger: "C3-level degradation is service-relevant, but automatic downtime is deferred until crack/RUL evidence crosses the planned-maintenance threshold.",
      evidence: `${baseEvidence}; ${tcsEvidence}`,
      kpiEffect: "TCS shifts from pure monitoring to preparation, reducing future logistics and failure-risk cost.",
      authority: "Planner approval required"
    };
  }

  if (serviceState === "MaintenanceDue") {
    return {
      name: "Planned blade maintenance execution",
      trigger: "C4/C5 or low-RUL evidence has crossed the intervention threshold.",
      evidence: `${baseEvidence}; ${tcsEvidence}`,
      kpiEffect: "TCS now favours planned downtime because residual failure cost exceeds service and downtime cost.",
      authority: "Technician dispatch approval"
    };
  }

  return {
    name: "Contract-boundary hold or removal recommendation",
    trigger: "The asset is outside the acceptable service envelope.",
    evidence: `${baseEvidence}; ${tcsEvidence}`,
    kpiEffect: "TCS is dominated by failure consequence and contract exposure, so corrective intervention is preferred.",
    authority: "Contract manager and operator confirmation"
  };
}

function lineOption(labels: string[], series: Array<{ name: string; data: number[]; color: string }>, unit = "") {
  return {
    color: series.map((item) => item.color),
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(9, 14, 13, 0.92)",
      borderColor: "rgba(100, 226, 189, 0.32)",
      textStyle: { color: "#d9e7e3" },
      valueFormatter: (value: number) => `${value}${unit ? ` ${unit}` : ""}`
    },
    legend: { top: 0, right: 8, textStyle: { color: "#9db2ab" } },
    grid: { left: 42, right: 18, top: 42, bottom: 32 },
    xAxis: {
      type: "category",
      data: labels,
      boundaryGap: false,
      axisLine: { lineStyle: { color: "rgba(128, 169, 158, 0.34)" } },
      axisTick: { lineStyle: { color: "rgba(128, 169, 158, 0.28)" } },
      axisLabel: { color: "#8fa7a0" }
    },
    yAxis: {
      type: "value",
      axisLine: { lineStyle: { color: "rgba(128, 169, 158, 0.34)" } },
      axisTick: { lineStyle: { color: "rgba(128, 169, 158, 0.28)" } },
      axisLabel: { color: "#8fa7a0" },
      splitLine: { lineStyle: { color: "rgba(128, 169, 158, 0.14)" } }
    },
    series: series.map((item) => ({
      name: item.name,
      type: "line",
      smooth: true,
      showSymbol: false,
      areaStyle: { opacity: 0.09 },
      data: item.data
    }))
  };
}

function rulOption(labels: string[], history: HistoryPoint[]) {
  return {
    color: ["#b7791f", "#26876d", "#4d78bd"],
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(9, 14, 13, 0.92)",
      borderColor: "rgba(100, 226, 189, 0.32)",
      textStyle: { color: "#d9e7e3" }
    },
    legend: { top: 0, right: 8, textStyle: { color: "#9db2ab" } },
    grid: { left: 46, right: 18, top: 42, bottom: 32 },
    xAxis: {
      type: "category",
      data: labels,
      boundaryGap: false,
      axisLine: { lineStyle: { color: "rgba(128, 169, 158, 0.34)" } },
      axisTick: { lineStyle: { color: "rgba(128, 169, 158, 0.28)" } },
      axisLabel: { color: "#8fa7a0" }
    },
    yAxis: {
      type: "value",
      name: "pseudo-h",
      nameTextStyle: { color: "#8fa7a0" },
      axisLine: { lineStyle: { color: "rgba(128, 169, 158, 0.34)" } },
      axisTick: { lineStyle: { color: "rgba(128, 169, 158, 0.28)" } },
      axisLabel: { color: "#8fa7a0" },
      splitLine: { lineStyle: { color: "rgba(128, 169, 158, 0.14)" } }
    },
    series: [
      { name: "Adjusted lower", type: "line", smooth: false, showSymbol: false, data: history.map((p) => p.rulP10) },
      { name: "p50", type: "line", smooth: false, showSymbol: false, lineStyle: { width: 3 }, data: history.map((p) => p.rulP50) },
      { name: "Adjusted upper", type: "line", smooth: false, showSymbol: false, data: history.map((p) => p.rulP90) }
    ]
  };
}

function directionOption(direction: number) {
  return {
    backgroundColor: "transparent",
    series: [
      {
        type: "gauge",
        startAngle: 90,
        endAngle: -270,
        min: 0,
        max: 360,
        splitNumber: 8,
        radius: "84%",
        pointer: { icon: "path://M2 0 L-2 0 L0 -82 Z", length: "68%", width: 10, itemStyle: { color: "#64e2bd" } },
        axisLine: { lineStyle: { width: 10, color: [[1, "rgba(128, 169, 158, 0.2)"]] } },
        axisTick: { distance: -18, length: 5, lineStyle: { color: "#8fa7a0" } },
        splitLine: { distance: -22, length: 10, lineStyle: { color: "#9db2ab", width: 2 } },
        axisLabel: { color: "#8fa7a0", distance: 18, formatter: (value: number) => (value % 90 === 0 ? cardinal(value) : "") },
        detail: { valueAnimation: true, formatter: `${direction} deg`, color: "#f4fbf8", fontSize: 24, offsetCenter: [0, "36%"] },
        data: [{ value: direction }]
      }
    ]
  };
}

function cardinal(deg: number) {
  const labels = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return labels[Math.round((deg % 360) / 45) % 8];
}

function replayGpsPosition(latest: HistoryPoint): LivePosition {
  const index = latest.acquisitionIndex ?? 0;
  const latOffset = Math.sin(index / 17) * 0.00018;
  const lonOffset = Math.cos(index / 19) * 0.00024;

  return {
    lat: site.lat + latOffset,
    lon: site.lon + lonOffset,
    accuracy: 8,
    source: "Chapter 5 replay GPS",
    updatedAt: latest.t
  };
}

function bearingDestination(lat: number, lon: number, bearingDeg: number, distanceKm: number): [number, number] {
  const radiusKm = 6371;
  const bearing = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;
  const angularDistance = distanceKm / radiusKm;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
    );

  return [(lat2 * 180) / Math.PI, (lon2 * 180) / Math.PI];
}

export default App;
