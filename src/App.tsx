import { useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import ReactFlow, { Background, Edge, MarkerType, Node } from "reactflow";
import { motion } from "framer-motion";
import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import {
  Activity,
  AlertTriangle,
  ClipboardCheck,
  Gauge,
  MapPin,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Waves,
  Wind,
  Workflow,
  Wrench,
  X
} from "lucide-react";
import dashboardData from "./data/dashboardData.json";

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
  status: "in-progress" | "completed";
  note: string;
  mode?: "manual" | "auto";
};

type AutoServiceRuntime = {
  action: MaintenanceActionKey;
  downtimeH: number;
  ticksRemaining: number;
  preServicePoint: HistoryPoint;
};

type AutoServiceStats = {
  totalDowntimeH: number;
  completedServices: number;
  lastAction?: MaintenanceActionKey;
  lastCompletedAt?: string;
};

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
    availability: { availability: number; description: string } | null;
    kpiSettlement: { actual_availability: number; contractual_target: number; delta_pp: number; settlement_gbp: number; status: string } | null;
  };
  history: HistoryPoint[];
};

const dataset = dashboardData as DashboardDataset;
const replayHistory = dataset.history ?? [];

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

function serviceStateFromRul(p10: number): ServiceState {
  if (p10 < 120) return "Critical";
  if (p10 < 240) return "MaintenanceDue";
  if (p10 < 430) return "Degraded";
  if (p10 < 670) return "Watch";
  return "Nominal";
}

function serviceStateFromCondition(point: Pick<HistoryPoint, "rulP10" | "crackMm" | "vibrationRms" | "kurtosis">): ServiceState {
  const crackMm = point.crackMm ?? 0;
  if (crackMm >= 80) return "OutOfContract";
  if (crackMm >= 60) return "MaintenanceDue";
  if (crackMm >= 45) return "MaintenanceDue";
  if (point.vibrationRms > 0.16 || point.kurtosis > 6.2) return "MaintenanceDue";
  if (crackMm >= 30) return "Degraded";
  if (point.vibrationRms > 0.12 || point.kurtosis > 4.8) return "Degraded";
  if (crackMm >= 20) return "Watch";
  if (point.vibrationRms > 0.085 || point.kurtosis > 3.7) return "Watch";
  return serviceStateFromRul(point.rulP10);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function makePoint(index: number, prior?: HistoryPoint): HistoryPoint {
  const now = new Date(Date.now() - (47 - index) * 90_000);
  const wave = Math.sin(index / 5);
  const gust = Math.sin(index / 2.8) * 0.45 + Math.random() * 0.35;
  const windSpeed = clamp((prior?.windSpeed ?? 5.8) + gust * 0.22, 3.2, 9.8);
  const windDirection = Math.round(((prior?.windDirection ?? 226) + 8 + Math.random() * 18) % 360);
  const rpm = Math.round(clamp(windSpeed * 68 + wave * 18 + Math.random() * 18, 190, 690));
  const power = Math.round(clamp(Math.pow(windSpeed, 2.15) * 9 + Math.random() * 32, 80, 430));
  const rulP50 = clamp((prior?.rulP50 ?? 760) - 4.2 + Math.sin(index / 6) * 8, 145, 850);
  const spread = clamp(130 + Math.cos(index / 4) * 28 + Math.random() * 24, 92, 190);
  const rulP10 = clamp(rulP50 - spread, 45, 760);
  const rulP90 = clamp(rulP50 + spread * 0.88, 180, 980);
  const vibrationRms = clamp(0.078 + (780 - rulP10) / 8000 + Math.random() * 0.012, 0.07, 0.185);
  const kurtosis = clamp(3.1 + (760 - rulP10) / 220 + Math.random() * 0.35, 3, 6.6);
  const modalF1 = clamp(27.6 - (760 - rulP10) / 220, 24.5, 27.8);

  return {
    t: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    windSpeed: Number(windSpeed.toFixed(2)),
    windDirection,
    rpm,
    power,
    vibrationRms: Number(vibrationRms.toFixed(3)),
    kurtosis: Number(kurtosis.toFixed(2)),
    modalF1: Number(modalF1.toFixed(2)),
    rulP10: Math.round(rulP10),
    rulP50: Math.round(rulP50),
    rulP90: Math.round(rulP90)
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

const maintenanceActions: Record<
  MaintenanceActionKey,
  { label: string; description: string; defaultDowntimeH: number; crackReduction: number; rulGain: number; vibrationFactor: number }
> = {
  "condition-inspection": {
    label: "Condition-based inspection",
    description: "Inspect the blade, verify crack state and keep the asset under watch.",
    defaultDowntimeH: 2,
    crackReduction: 0,
    rulGain: 60,
    vibrationFactor: 0.92
  },
  "preactive-maintenance": {
    label: "Preactive maintenance",
    description: "Early service before the formal threshold is crossed.",
    defaultDowntimeH: 4,
    crackReduction: 0.28,
    rulGain: 180,
    vibrationFactor: 0.82
  },
  "predictive-maintenance": {
    label: "Predictive maintenance",
    description: "RUL-triggered planned blade service using the DT prediction.",
    defaultDowntimeH: 8,
    crackReduction: 0.55,
    rulGain: 360,
    vibrationFactor: 0.64
  },
  "proactive-maintenance": {
    label: "Proactive maintenance",
    description: "Prevent recurrence through planned repair and operating-policy update.",
    defaultDowntimeH: 10,
    crackReduction: 0.62,
    rulGain: 420,
    vibrationFactor: 0.58
  },
  "active-maintenance": {
    label: "Active maintenance",
    description: "Immediate intervention while degradation is active.",
    defaultDowntimeH: 12,
    crackReduction: 0.72,
    rulGain: 470,
    vibrationFactor: 0.5
  },
  "corrective-maintenance": {
    label: "Corrective maintenance",
    description: "Repair or replace the blade after a high-risk or failed condition.",
    defaultDowntimeH: 24,
    crackReduction: 1,
    rulGain: 850,
    vibrationFactor: 0.38
  },
  "spare-prepositioning": {
    label: "Spare-part pre-positioning",
    description: "Reserve blade kit and logistics slot; no immediate physical repair.",
    defaultDowntimeH: 1,
    crackReduction: 0,
    rulGain: 35,
    vibrationFactor: 0.98
  }
};

const serviceEconomics: Record<
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

const tcsParameters = {
  downtimeCostPerHour: 95,
  availabilityPenaltyPerHour: 42,
  energyValuePerKwh: 0.28,
  unplannedFailureConsequence: 9800
};

function App() {
  const [cursor, setCursor] = useState(0);
  const [history, setHistory] = useState<HistoryPoint[]>(() =>
    makeInitialReplayHistory()
  );
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [inputOpen, setInputOpen] = useState(false);
  const [manualPoint, setManualPoint] = useState<HistoryPoint | null>(null);
  const [serviceExecution, setServiceExecution] = useState<ServiceExecution | null>(null);
  const [autoStats, setAutoStats] = useState<AutoServiceStats>({ totalDowntimeH: 0, completedServices: 0 });
  const [chainStep, setChainStep] = useState(0);
  const [devicePosition, setDevicePosition] = useState<LivePosition | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const gpsWatchRef = useRef<number | null>(null);
  const manualPointRef = useRef<HistoryPoint | null>(null);
  const autoServiceRef = useRef<AutoServiceRuntime | null>(null);
  const autoPostServiceOverrideRef = useRef(false);
  const autoCooldownRef = useRef(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setHistory((current) => {
        const prior = current[current.length - 1];
        const replayPoint =
          replayHistory.length > 0 ? replayHistory[cursor % replayHistory.length] : makePoint(current.length, prior);
        let next = replayPoint;

        if (!manualPointRef.current) {
          const activeService = autoServiceRef.current;

          if (activeService) {
            if (activeService.ticksRemaining > 1) {
              activeService.ticksRemaining -= 1;
              next = makeDowntimePoint(activeService.preServicePoint, activeService);
            } else {
              next = applyMaintenanceResult(activeService.preServicePoint, activeService.action, activeService.downtimeH);
              next = {
                ...next,
                serviceNote: `Auto closed-loop ${maintenanceActions[activeService.action].label} completed; WT state refreshed after downtime.`
              };
              autoServiceRef.current = null;
              autoPostServiceOverrideRef.current = true;
              autoCooldownRef.current = 8;
              setAutoStats((stats) => ({
                totalDowntimeH: Number((stats.totalDowntimeH + activeService.downtimeH).toFixed(1)),
                completedServices: stats.completedServices + 1,
                lastAction: activeService.action,
                lastCompletedAt: next.t
              }));
              setServiceExecution({
                action: activeService.action,
                downtimeH: activeService.downtimeH,
                status: "completed",
                mode: "auto",
                note: `${maintenanceActions[activeService.action].label} completed automatically; crack, RUL and vibration are updated.`
              });
            }
          } else {
            next = simulateAutoTwinPoint(replayPoint, prior, cursor, !autoPostServiceOverrideRef.current);
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
                  preServicePoint: next
                };
                autoServiceRef.current = runtime;
                next = makeDowntimePoint(next, runtime);
                setServiceExecution({
                  action,
                  downtimeH,
                  status: "in-progress",
                  mode: "auto",
                  note: `Auto DT selected ${maintenanceActions[action].label} from crack/RUL evidence.`
                });
              }
            }
          }
        }

        return [...current.slice(1), next];
      });
      setCursor((current) => current + 1);
      setChainStep((step) => (step + 1) % 6);
    }, 1400);

    return () => window.clearInterval(timer);
  }, [cursor]);

  useEffect(() => {
    manualPointRef.current = manualPoint;
    if (manualPoint) {
      autoServiceRef.current = null;
    }
  }, [manualPoint]);

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
  const timeLabels = chartHistory.map((point) => point.t);
  const replayPosition = replayGpsPosition(latest);
  const manualPosition: LivePosition | null =
    manualPoint?.lat != null && manualPoint.lon != null
      ? {
          lat: manualPoint.lat,
          lon: manualPoint.lon,
          accuracy: 5,
          source: "Manual input GPS",
          updatedAt: manualPoint.t
        }
      : null;
  const currentPosition = manualPosition ?? devicePosition ?? replayPosition;

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
        setDevicePosition({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
          source: "Device GPS",
          updatedAt: new Date(position.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        });
      },
      (error) => {
        setGpsError(error.message);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  }

  function executeMaintenanceAction(action: MaintenanceActionKey, downtimeH: number) {
    const actionConfig = maintenanceActions[action];
    const boundedDowntime = clamp(downtimeH, 0.25, 168);
    const current = latest;
    const inProgressPoint: HistoryPoint = {
      ...current,
      t: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      source: "service-action",
      rpm: 0,
      power: 0,
      serviceMode: "in-downtime",
      serviceAction: action,
      downtimeH: boundedDowntime,
      availabilityPct: availabilityAfterDowntime(boundedDowntime),
      serviceState: "MaintenanceDue",
      serviceNote: `${actionConfig.label} in progress during ${boundedDowntime.toFixed(1)} h downtime`
    };

    setManualPoint(inProgressPoint);
    setServiceExecution({
      action,
      downtimeH: boundedDowntime,
      status: "in-progress",
      mode: "manual",
      note: actionConfig.description
    });

    window.setTimeout(() => {
      const repaired = applyMaintenanceResult(current, action, boundedDowntime);
      setManualPoint(repaired);
      setServiceExecution({
        action,
        downtimeH: boundedDowntime,
        status: "completed",
        mode: "manual",
        note: `${actionConfig.label} completed; WT state updated from post-service evidence.`
      });
    }, 2200);
  }

  const dtNodes: Node[] = useMemo(
    () => [
      flowNode("gps", "GPS + Wind", "Context provenance", 0, 30, chainStep === 0),
      flowNode("ome", "OME", "Turbine-01 / Blade-A", 170, 30, chainStep === 1),
      flowNode("dcdce", "DCDCE", "Sensor / ESP32 / Jetson", 350, 30, chainStep === 2),
      flowNode("dte", "DTE", "Feature / RUL / Ontology", 550, 30, chainStep === 3),
      flowNode("state", "Service-State", serviceState, 760, 30, chainStep === 4, meta.color),
      flowNode("ue", "UE + KPI", "Action / Contract KPI", 970, 30, chainStep === 5)
    ],
    [chainStep, meta.color, serviceState]
  );

  const dtEdges: Edge[] = useMemo(
    () => [
      flowEdge("gps-ome", "gps", "ome", chainStep === 0),
      flowEdge("ome-dcdce", "ome", "dcdce", chainStep === 1),
      flowEdge("dcdce-dte", "dcdce", "dte", chainStep === 2),
      flowEdge("dte-state", "dte", "state", chainStep === 3),
      flowEdge("state-ue", "state", "ue", chainStep === 4),
      flowEdge("ue-gps", "ue", "gps", chainStep === 5, true)
    ],
    [chainStep]
  );

  return (
    <main className="dashboard">
      <header className="topbar">
        <div>
          <p className="eyebrow">WT Servitization Digital Twin</p>
          <h1>Operation, Evidence Chain and Contract State</h1>
          <span className="data-source">
            {manualPoint ? "Manual scenario mode" : "Auto DT closed-loop simulation"} | {dataset.summary?.totalAcquisitions ?? replayHistory.length} acquisitions | {site.sourceStatus}
          </span>
        </div>
        <div className="top-actions">
          <button className="secondary-action" type="button" onClick={() => setInputOpen(true)}>
            <SlidersHorizontal size={15} />
            Input scenario
          </button>
          {manualPoint ? (
            <button className="secondary-action" type="button" onClick={() => setManualPoint(null)}>
              <RotateCcw size={15} />
              Resume replay
            </button>
          ) : null}
          <div className="status-pill" style={{ color: meta.color, background: meta.bg }}>
            <ShieldCheck size={18} />
            <span>{serviceState}</span>
          </div>
        </div>
      </header>

      <section className="metric-row" aria-label="Live WT metrics">
        <Metric icon={<MapPin />} label="GPS" value={`${currentPosition.lat.toFixed(4)}, ${currentPosition.lon.toFixed(4)}`} sub={currentPosition.source} />
        <Metric icon={<Wind />} label="Wind speed" value={`${latest.windSpeed.toFixed(1)} m/s`} sub={`${cardinal(latest.windDirection)} ${latest.windDirection} deg`} />
        <Metric icon={<Gauge />} label="Rotor RPM" value={`${latest.rpm}`} sub={`${latest.power} W output`} />
        <Metric icon={<Activity />} label="Blade vibration" value={`${latest.vibrationRms.toFixed(3)} g`} sub={`${latest.crackState ?? "C?"} | kurtosis ${latest.kurtosis.toFixed(2)}`} />
        <Metric icon={<Waves />} label="Blade RUL" value={`${latest.rulP10} / ${latest.rulP50} / ${latest.rulP90} h`} sub="p10 / p50 / p90 from replay" />
      </section>

      <section className="main-grid">
        <SiteMap latest={latest} serviceState={serviceState} position={currentPosition} gpsError={gpsError} onEnableGps={enableDeviceGps} />
        <TurbinePanel latest={latest} serviceState={serviceState} />
        <DecisionPanel
          latest={latest}
          serviceState={serviceState}
          execution={serviceExecution}
          autoStats={autoStats}
          onEvidence={() => setEvidenceOpen(true)}
          onExecuteAction={executeMaintenanceAction}
        />
      </section>

      <section className="dt-chain">
        <div className="section-title">
          <Workflow size={18} />
          <h2>ISO 23247 Servitization DT Evidence Chain</h2>
        </div>
        <p className="chain-caption">
          Chapter 3 framework entities plus Chapter 4 ontology trace: context evidence becomes RUL, service state, action and contract KPI.
        </p>
        <div className="flow-shell">
          <ReactFlow
            nodes={dtNodes}
            edges={dtEdges}
            fitView
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            zoomOnScroll={false}
            panOnDrag={false}
            preventScrolling={false}
          >
            <Background color="#d7dee8" gap={18} />
          </ReactFlow>
        </div>
      </section>

      <section className="chart-grid" aria-label="Dynamic telemetry charts">
        <Chart title="Wind Speed" option={lineOption(timeLabels, [{ name: "m/s", data: chartHistory.map((p) => p.windSpeed), color: "#26876d" }], "m/s")} />
        <Chart title="Wind Direction" option={directionOption(latest.windDirection)} />
        <Chart title="Blade Vibration" option={lineOption(timeLabels, [
          { name: "RMS g", data: chartHistory.map((p) => p.vibrationRms), color: "#c25f2d" },
          { name: "Kurtosis", data: chartHistory.map((p) => p.kurtosis), color: "#7057c8" }
        ])} />
        <Chart title="Blade RUL Uncertainty" option={rulOption(timeLabels, chartHistory)} />
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
          onApply={(point) => {
            setManualPoint(point);
            setInputOpen(false);
          }}
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
        <MapContainer center={center} zoom={15} scrollWheelZoom={false} className="leaflet-map" attributionControl={false}>
          <MapRecenter center={center} />
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
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
              RUL p10/p50/p90: {latest.rulP10}/{latest.rulP50}/{latest.rulP90} h
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

function TurbinePanel({ latest, serviceState }: { latest: HistoryPoint; serviceState: ServiceState }) {
  const bladesRef = useRef<HTMLDivElement | null>(null);
  const bladeAngleRef = useRef(0);
  const visualVelocityRef = useRef(0);
  const rpmRef = useRef(latest.rpm);
  const serviceModeRef = useRef(latest.serviceMode);
  const meta = stateMeta[serviceState];
  const crackMm = latest.crackMm ?? 0;
  const severity = clamp(crackMm / 80, 0, 1);
  const crackWidth = severity * 68;
  const crackOpacity = crackMm > 0 ? clamp(0.28 + severity * 0.67, 0, 0.95) : 0;
  const crackLabel = `${latest.crackState ?? "C?"} | ${crackMm.toFixed(0)} mm crack | p10 RUL ${latest.rulP10} h`;
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
      const targetVelocity =
        serviceModeRef.current === "in-downtime" ? 0 : clamp((rpmRef.current / 680) * 560, 0, 720);
      const response = 1 - Math.exp(-deltaSeconds * 3.2);
      visualVelocityRef.current += (targetVelocity - visualVelocityRef.current) * response;
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
    <section className="panel turbine-panel">
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
        </div>
        <div className="sensor-dot" style={{ background: meta.color }} />
        <div className="crack-readout" style={{ borderColor: meta.color }}>
          <span>Blade crack detection</span>
          <strong>{crackLabel}</strong>
          <em>{serviceLabel ?? `RUL band ${latest.rulP10}/${latest.rulP50}/${latest.rulP90} h`}</em>
        </div>
        <div className="ground-band" />
      </div>
      <div className="operation-strip">
        <span>RPM <strong>{latest.rpm}</strong></span>
        <span>Power <strong>{latest.power} W</strong></span>
        <span>f1 <strong>{latest.modalF1.toFixed(2)} Hz</strong></span>
        <span>Crack <strong>{crackMm.toFixed(0)} mm</strong></span>
        <span>Regime <strong>{regime}</strong></span>
      </div>
    </section>
  );
}

function DecisionPanel({
  latest,
  serviceState,
  execution,
  autoStats,
  onEvidence,
  onExecuteAction
}: {
  latest: HistoryPoint;
  serviceState: ServiceState;
  execution: ServiceExecution | null;
  autoStats: AutoServiceStats;
  onEvidence: () => void;
  onExecuteAction: (action: MaintenanceActionKey, downtimeH: number) => void;
}) {
  const suggestedAction = suggestedMaintenanceAction(latest, serviceState);
  const [selectedAction, setSelectedAction] = useState<MaintenanceActionKey>(suggestedAction);
  const [downtimeH, setDowntimeH] = useState(maintenanceActions[suggestedAction].defaultDowntimeH);
  const meta = stateMeta[serviceState];
  const availability = latest.availabilityPct ?? (dataset.service?.kpiSettlement?.actual_availability
    ? dataset.service.kpiSettlement.actual_availability * 100
    : clamp(99.2 - (760 - latest.rulP10) / 160, 91.5, 99.3));
  const energyYield = Math.round(1760 + latest.power * 0.42);
  const settlement = dataset.service?.kpiSettlement;
  const activity = servitizationActivity(latest, serviceState);
  const actionConfig = maintenanceActions[selectedAction];
  const recommendedTcs = estimateTcs(latest, suggestedAction);
  const selectedTcs = estimateTcs(latest, selectedAction, downtimeH);
  const tcsAlternatives = (Object.keys(maintenanceActions) as MaintenanceActionKey[])
    .map((action) => estimateTcs(latest, action))
    .sort((a, b) => a.totalCost - b.totalCost);
  const maxTcsCost = Math.max(...tcsAlternatives.map((estimate) => estimate.totalCost), 1);

  useEffect(() => {
    setSelectedAction(suggestedAction);
    setDowntimeH(maintenanceActions[suggestedAction].defaultDowntimeH);
  }, [suggestedAction]);

  function changeAction(value: string) {
    const action = value as MaintenanceActionKey;
    setSelectedAction(action);
    setDowntimeH(maintenanceActions[action].defaultDowntimeH);
  }

  return (
    <section className="panel decision-panel">
      <div className="section-title">
        <ClipboardCheck size={18} />
        <h2>Service Decision</h2>
      </div>
      <div className="state-card" style={{ borderColor: meta.color, background: meta.bg }}>
        <span>Current Service-State</span>
        <strong style={{ color: meta.color }}>{serviceState}</strong>
      </div>
      <dl className="decision-list">
        <div>
          <dt>Recommended action</dt>
          <dd>{maintenanceActions[suggestedAction].label}</dd>
        </div>
        <div>
          <dt>KPI status</dt>
          <dd>{meta.kpi}</dd>
        </div>
        <div>
          <dt>Availability</dt>
          <dd>{availability.toFixed(1)}%</dd>
        </div>
        <div>
          <dt>Contract status</dt>
          <dd>{settlement ? `${settlement.status} GBP ${settlement.settlement_gbp}` : `${energyYield} kWh eq.`}</dd>
        </div>
        <div>
          <dt>TCS selected</dt>
          <dd>{formatGbp(recommendedTcs.totalCost)}</dd>
        </div>
        <div>
          <dt>Auto downtime</dt>
          <dd>{autoStats.totalDowntimeH.toFixed(1)} h</dd>
        </div>
        <div>
          <dt>Auto services</dt>
          <dd>
            {autoStats.completedServices}
            {autoStats.lastAction ? ` | ${maintenanceActions[autoStats.lastAction].label}` : ""}
          </dd>
        </div>
      </dl>
      <div className="tcs-output">
        <div className="activity-header">
          <ClipboardCheck size={17} />
          <span>Total Cost of Servitization</span>
        </div>
        <div className="tcs-hero">
          <strong>{formatGbp(recommendedTcs.totalCost)}</strong>
          <span>{maintenanceActions[recommendedTcs.action].label}</span>
        </div>
        <div className="tcs-grid">
          <span>Service</span>
          <b>{formatGbp(recommendedTcs.directCost)}</b>
          <span>Downtime</span>
          <b>{formatGbp(recommendedTcs.downtimeCost)}</b>
          <span>Logistics</span>
          <b>{formatGbp(recommendedTcs.logisticsCost)}</b>
          <span>Contract</span>
          <b>{formatGbp(recommendedTcs.contractCost)}</b>
          <span>Residual risk</span>
          <b>{formatGbp(recommendedTcs.residualRiskCost)}</b>
        </div>
        <div className="tcs-alternatives">
          <div className="tcs-table-head">
            <span>Strategy cost comparison</span>
            <b>Total / risk</b>
          </div>
          {tcsAlternatives.map((estimate) => (
            <div className={estimate.action === suggestedAction ? "tcs-option selected" : "tcs-option"} key={estimate.action}>
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
          ))}
        </div>
      </div>
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
      <div className="service-action-box">
        <div className="activity-header">
          <Wrench size={17} />
          <span>Servitization Action</span>
        </div>
        <label>
          <span>Action type</span>
          <select value={selectedAction} onChange={(event) => changeAction(event.target.value)}>
            {Object.entries(maintenanceActions).map(([key, action]) => (
              <option key={key} value={key}>
                {action.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Downtime for service h</span>
          <input
            type="number"
            min="0.25"
            max="168"
            step="0.25"
            value={downtimeH}
            onChange={(event) => setDowntimeH(Number(event.target.value))}
          />
        </label>
        <p>
          {actionConfig.description} Selected TCS estimate: {formatGbp(selectedTcs.totalCost)}; residual risk score {selectedTcs.residualRiskScore.toFixed(2)}.
        </p>
        {execution ? (
          <div className={execution.status === "completed" ? "service-run completed" : "service-run"}>
            <strong>{maintenanceActions[execution.action].label}</strong>
            <span>
              {execution.mode === "auto" ? "Auto-selected" : "Manual"} | {execution.status === "in-progress" ? "Downtime in progress" : "Completed"} | {execution.downtimeH.toFixed(1)} h downtime
            </span>
            <small>{execution.note}</small>
          </div>
        ) : null}
        <button className="primary-action compact" type="button" onClick={() => onExecuteAction(selectedAction, downtimeH)}>
          Execute service action
        </button>
      </div>
      <button className="primary-action" onClick={onEvidence}>
        <Workflow size={16} />
        Evidence chain
      </button>
    </section>
  );
}

function Chart({ title, option }: { title: string; option: object }) {
  return (
    <section className="panel chart-panel">
      <h2>{title}</h2>
      <ReactECharts option={option} notMerge lazyUpdate style={{ height: 230 }} />
    </section>
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
          <EvidenceItem label="FeatureVector" value={`RMS ${latest.vibrationRms.toFixed(3)} g | kurtosis ${latest.kurtosis.toFixed(2)} | f1 ${latest.modalF1.toFixed(2)} Hz | crack ${latest.crackState ?? "n/a"} ${latest.crackMm ?? 0} mm | growth ${latest.crackGrowthRateMmH?.toFixed(2) ?? "n/a"} mm/tick`} />
          <EvidenceItem label="RULEstimate" value={`p10 ${latest.rulP10} h | p50 ${latest.rulP50} h | p90 ${latest.rulP90} h`} />
          <EvidenceItem label="ServiceState" value={serviceState} accent={meta.color} />
          <EvidenceItem label="ServiceActionRecommendation" value={meta.action} />
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

  const previewPoint = pointFromScenarioForm(form);
  const previewState = serviceStateFromCondition(previewPoint);
  const previewMeta = stateMeta[previewState];
  const previewActivity = servitizationActivity(previewPoint, previewState);
  const touchedCount = Object.keys(touched).length;
  const conflicts = touchedCount >= 2 ? scenarioConflicts(form, touched) : [];

  function updateNumber(key: keyof ScenarioForm, value: string) {
    const parsed = Number(value);
    const nextValue = Number.isFinite(parsed) ? parsed : 0;
    const nextTouched = { ...touched, [key]: true };
    setTouched(nextTouched);
    setForm((current) => {
      const rawNext = { ...current, [key]: nextValue };
      return applyScenarioModel(rawNext, nextTouched);
    });
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
          <NumberField label="Blade vibration RMS g" value={form.vibrationRms} step="0.001" onChange={(value) => updateNumber("vibrationRms", value)} />
          <NumberField label="Kurtosis" value={form.kurtosis} step="0.01" onChange={(value) => updateNumber("kurtosis", value)} />
          <NumberField label="Modal f1 Hz" value={form.modalF1} step="0.01" onChange={(value) => updateNumber("modalF1", value)} />
          <NumberField label="Crack length mm" value={form.crackMm} step="1" onChange={(value) => updateNumber("crackMm", value)} />
          <NumberField label="RUL p10 h" value={form.rulP10} step="1" onChange={(value) => updateNumber("rulP10", value)} />
          <NumberField label="RUL p50 h" value={form.rulP50} step="1" onChange={(value) => updateNumber("rulP50", value)} />
          <NumberField label="RUL p90 h" value={form.rulP90} step="1" onChange={(value) => updateNumber("rulP90", value)} />
        </div>

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
            <p>{touchedCount >= 2 ? "No conflicts detected between the manually edited parameters." : "Edit two or more related parameters to enable conflict checking."}</p>
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
      <input type="number" value={value} step={step} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function pointFromScenarioForm(form: ScenarioForm): HistoryPoint {
  const crackMm = clamp(form.crackMm, 0, 80);
  const crackState = crackStateFromMm(crackMm);
  const point = {
    t: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    acquisitionIndex: 9999,
    source: "manual-input",
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
  const crackFactor = clamp(crackMm / 80, 0, 1);
  const loadPenalty = Math.round(Math.max(0, base.windSpeed - 7) * 18 + Math.max(0, base.windSpeed - 11) * 42);
  const rulP50 = Math.round(clamp(1000 * (1 - Math.pow(crackFactor, 1.16)) - loadPenalty * 0.7, 0, 1000));
  const rulSpread = Math.max(50, Math.round(128 - crackFactor * 58));
  const vibrationRms = Number(clamp(0.038 + base.windSpeed * 0.004 + crackFactor * 0.112 + Math.max(0, base.windSpeed - 9) * 0.006, 0.028, 0.32).toFixed(4));
  const kurtosis = Number(clamp(2.65 + crackFactor * 4.2 + Math.max(0, base.windSpeed - 8) * 0.18, 2.5, 12).toFixed(2));
  const modalF1 = Number(clamp(27.55 - crackFactor * 3.8 - Math.max(0, base.windSpeed - 10) * 0.07, 18, 32).toFixed(2));
  const rpm = base.windSpeed < 3 ? 0 : Math.round(clamp(base.windSpeed * 78 + Math.sin(index / 4) * 28, 0, 1200));
  const power = base.windSpeed < 3 ? 0 : Math.round(clamp(Math.pow(base.windSpeed, 2.12) * 8.9, 0, 800));
  const point: HistoryPoint = {
    ...base,
    source: "auto-simulation",
    rpm,
    power,
    vibrationRms,
    kurtosis,
    modalF1,
    crackMm,
    crackState: crackStateFromMm(crackMm),
    crackGrowthRateMmH: Number(growthRate.toFixed(2)),
    windBin: windBinFromSpeed(base.windSpeed),
    rulP10: Math.max(0, Math.round(rulP50 - rulSpread - loadPenalty * 0.3)),
    rulP50,
    rulP90: Math.max(0, Math.round(rulP50 + rulSpread * 0.82)),
    serviceMode: undefined,
    serviceAction: undefined,
    downtimeH: undefined,
    serviceNote: `Auto crack detection: +${growthRate.toFixed(2)} mm/tick, RUL recalculated from crack and wind load.`
  };

  return { ...point, serviceState: serviceStateFromCondition(point) };
}

function crackGrowthRate(point: HistoryPoint, crackMm: number, index: number) {
  const load = Math.max(0, point.windSpeed - 4.5) * 0.11;
  const vibration = Math.max(0, point.vibrationRms - 0.04) * 2.4;
  const damageAcceleration = clamp(crackMm / 80, 0, 1) * 0.34;
  const cyclePulse = (Math.sin(index / 8) + 1) * 0.08;
  return clamp(0.16 + load + vibration + damageAcceleration + cyclePulse, 0.08, 1.65);
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
    rpm: 0,
    power: 0,
    serviceMode: "in-downtime",
    serviceAction: runtime.action,
    downtimeH: runtime.downtimeH,
    availabilityPct: availabilityAfterDowntime(runtime.downtimeH),
    serviceState: "MaintenanceDue",
    serviceNote: `Auto ${maintenanceActions[runtime.action].label} in progress; planned downtime ${runtime.downtimeH.toFixed(1)} h.`
  };
}

function suggestedMaintenanceAction(point: HistoryPoint, serviceState: ServiceState): MaintenanceActionKey {
  return serviceDecisionByTcs(point, serviceState).action;
}

function serviceDecisionByTcs(point: HistoryPoint, serviceState: ServiceState) {
  const candidates = serviceCandidatesForState(point, serviceState);
  const estimates = candidates
    .map((action) => estimateTcs(point, action))
    .sort((a, b) => a.totalCost - b.totalCost);
  const riskFiltered = estimates.filter((estimate) => isRiskAcceptableAfterAction(point, estimate, serviceState));

  return riskFiltered[0] ?? estimates[0];
}

function serviceCandidatesForState(point: HistoryPoint, serviceState: ServiceState): MaintenanceActionKey[] {
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

function isRiskAcceptableAfterAction(point: HistoryPoint, estimate: ServiceCostEstimate, serviceState: ServiceState) {
  const crackMm = point.crackMm ?? 0;

  if (serviceState === "OutOfContract" || crackMm >= 80) return estimate.residualCrackMm < 20 && estimate.residualRiskScore < 0.24;
  if (serviceState === "Critical" || crackMm >= 60 || point.rulP10 < 240) return estimate.residualCrackMm < 45 && estimate.residualRiskScore < 0.34;
  if (crackMm >= 45 || point.rulP10 < 360) return estimate.residualCrackMm < 35 && estimate.residualRiskScore < 0.42;
  if (crackMm >= 30 || serviceState === "Degraded") return estimate.residualRiskScore < 0.56;
  return estimate.residualRiskScore < 0.72;
}

function estimateTcs(point: HistoryPoint, action: MaintenanceActionKey, downtimeOverride?: number): ServiceCostEstimate {
  const actionConfig = maintenanceActions[action];
  const economics = serviceEconomics[action];
  const downtimeH = downtimeOverride ?? actionConfig.defaultDowntimeH;
  const crackBefore = point.crackMm ?? 0;
  const residualCrackMm = Number(clamp(crackBefore * (1 - actionConfig.crackReduction), 0, 80).toFixed(1));
  const residualRulP10 = Math.max(0, Math.round(point.rulP10 + actionConfig.rulGain * 0.62));
  const residualRiskScore =
    residualRiskAfterAction(point, residualCrackMm, residualRulP10) * economics.riskMultiplier;
  const downtimeCost = downtimeH * tcsParameters.downtimeCostPerHour + (point.power / 1000) * downtimeH * tcsParameters.energyValuePerKwh;
  const contractCost = downtimeH * tcsParameters.availabilityPenaltyPerHour * (point.rulP10 < 360 ? 1.25 : 1);
  const residualRiskCost = Math.pow(residualRiskScore, 2) * tcsParameters.unplannedFailureConsequence;
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

function residualRiskAfterAction(point: HistoryPoint, residualCrackMm: number, residualRulP10: number) {
  const crackRisk = clamp(residualCrackMm / 80, 0, 1) * 0.48;
  const rulRisk = clamp(1 - residualRulP10 / 900, 0, 1) * 0.32;
  const vibrationRisk = clamp((point.vibrationRms - 0.04) / 0.18, 0, 1) * 0.13;
  const loadRisk = clamp((point.windSpeed - 7) / 7, 0, 1) * 0.07;
  return clamp(crackRisk + rulRisk + vibrationRisk + loadRisk, 0.02, 0.98);
}

function availabilityAfterDowntime(downtimeH: number) {
  const downtimePenalty = (clamp(downtimeH, 0, 168) / (30 * 24)) * 100;
  return Number(clamp(99.4 - downtimePenalty, 82, 99.4).toFixed(1));
}

function formatGbp(value: number) {
  return `GBP ${Math.round(value).toLocaleString("en-GB")}`;
}

function applyMaintenanceResult(current: HistoryPoint, action: MaintenanceActionKey, downtimeH: number): HistoryPoint {
  const actionConfig = maintenanceActions[action];
  const crackBefore = current.crackMm ?? 0;
  const crackAfter = Number(clamp(crackBefore * (1 - actionConfig.crackReduction), 0, 80).toFixed(1));
  const crackFactor = clamp(crackAfter / 80, 0, 1);
  const rulP50 = Math.round(clamp(current.rulP50 + actionConfig.rulGain, current.rulP50, 1000));
  const rulSpread = Math.max(45, Math.round(125 - crackFactor * 60));
  const vibrationRms = Number(clamp(current.vibrationRms * actionConfig.vibrationFactor, 0.028, 0.32).toFixed(4));
  const kurtosis = Number(clamp(2.7 + crackFactor * 3.2 + Math.max(0, current.windSpeed - 8) * 0.12, 2.4, 12).toFixed(2));
  const modalF1 = Number(clamp(27.55 - crackFactor * 3.4 - Math.max(0, current.windSpeed - 10) * 0.04, 18, 32).toFixed(2));
  const restoredRpm = current.windSpeed < 3 ? 0 : Math.max(current.rpm, Math.round(current.windSpeed * 76));

  const point: HistoryPoint = {
    ...current,
    t: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    source: "service-action",
    rpm: restoredRpm,
    power: current.windSpeed < 3 ? 0 : Math.max(current.power, Math.round(Math.pow(current.windSpeed, 2.08) * 8.1)),
    vibrationRms,
    kurtosis,
    modalF1,
    crackMm: crackAfter,
    crackState: crackStateFromMm(crackAfter),
    windBin: windBinFromSpeed(current.windSpeed),
    rulP10: Math.max(0, Math.round(rulP50 - rulSpread)),
    rulP50,
    rulP90: Math.min(1100, Math.round(rulP50 + rulSpread * 0.82)),
    serviceMode: "post-service",
    serviceAction: action,
    downtimeH,
    availabilityPct: availabilityAfterDowntime(downtimeH),
    serviceNote: `${actionConfig.label} completed: crack ${crackBefore.toFixed(0)} mm -> ${crackAfter.toFixed(0)} mm, RUL p50 -> ${rulP50} h`
  };

  return { ...point, serviceState: serviceStateFromCondition(point) };
}

function applyScenarioModel(form: ScenarioForm, touched: Partial<Record<keyof ScenarioForm, true>>): ScenarioForm {
  const expected = expectedScenarioValues(form);
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
  if (!touched.rulP90 && touched.rulP50) next.rulP90 = Math.max(0, Math.round(next.rulP50 + expected.rulSpread * 0.82));

  return next;
}

function expectedScenarioValues(form: ScenarioForm) {
  const crackMm = clamp(form.crackMm, 0, 80);
  const crackFactor = clamp(crackMm / 80, 0, 1);
  const wind = windCoupledInputs(form.windSpeed, {
    crackMm,
    modalF1: form.modalF1,
    rulP10: form.rulP10,
    rulP50: form.rulP50,
    rulP90: form.rulP90
  });
  const baseRulP50 = Math.round(clamp(1000 * (1 - Math.pow(crackFactor, 1.18)), 0, 1000));
  const windPenalty = Math.round(Math.max(0, form.windSpeed - 7) * 18 + Math.max(0, form.windSpeed - 11) * 38);
  const rulSpread = Math.max(55, Math.round(125 - crackFactor * 54));
  const rulP50 = Math.max(0, baseRulP50 - Math.round(windPenalty * 0.65));
  const rulP10 = Math.max(0, rulP50 - rulSpread - Math.round(windPenalty * 0.35));
  const rulP90 = Math.max(0, rulP50 + Math.round(rulSpread * 0.82));

  return {
    ...wind,
    rulP10,
    rulP50,
    rulP90,
    rulSpread
  };
}

function scenarioConflicts(form: ScenarioForm, touched: Partial<Record<keyof ScenarioForm, true>>) {
  const expected = expectedScenarioValues(form);
  const conflicts: string[] = [];
  const manuallySet = (a: keyof ScenarioForm, b: keyof ScenarioForm) => touched[a] && touched[b];

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
    conflicts.push(`Damage/load and RUL conflict: expected p10 RUL is about ${expected.rulP10} h, not ${Math.round(form.rulP10)} h.`);
  }

  return conflicts;
}

function outsideRelativeTolerance(actual: number, expected: number, relativeTolerance: number, absoluteTolerance: number) {
  return Math.abs(actual - expected) > Math.max(Math.abs(expected) * relativeTolerance, absoluteTolerance);
}

function windCoupledInputs(
  windSpeed: number,
  current: {
    crackMm: number;
    modalF1: number;
    rulP10: number;
    rulP50: number;
    rulP90: number;
  }
) {
  const speed = clamp(windSpeed, 0, 25);
  const crackFactor = clamp(current.crackMm / 80, 0, 1);
  const regimeStress = speed < 3 ? 0.15 : speed < 7 ? 0.45 : speed < 11 ? 0.82 : 1.18;
  const rpm = Math.round(clamp(speed * 78 + regimeStress * 46, 0, 1200));
  const power = Math.round(clamp(Math.pow(speed, 2.12) * 8.9, 0, 800));
  const vibrationRms = Number(clamp(0.035 + speed * 0.0065 + crackFactor * 0.072 + Math.max(0, speed - 10) * 0.008, 0.02, 0.32).toFixed(4));
  const kurtosis = Number(clamp(2.7 + crackFactor * 3.2 + Math.max(0, speed - 8) * 0.22, 2.5, 12).toFixed(2));
  const modalF1 = Number(clamp(27.55 - crackFactor * 3.4 - Math.max(0, speed - 10) * 0.08, 18, 32).toFixed(2));
  const riskPenalty = Math.round(Math.max(0, speed - 7) * 18 + Math.max(0, speed - 11) * 38);

  return {
    rpm,
    power,
    vibrationRms,
    kurtosis,
    modalF1,
    rulP10: Math.max(0, current.rulP10 - riskPenalty),
    rulP50: Math.max(0, current.rulP50 - Math.round(riskPenalty * 0.65)),
    rulP90: Math.max(0, current.rulP90 - Math.round(riskPenalty * 0.45))
  };
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
  const baseEvidence = `${latest.crackState ?? "C?"}, ${operatingRegime(latest.windSpeed)}, p10 RUL ${latest.rulP10} h, RMS ${latest.vibrationRms.toFixed(3)} g${growthEvidence}`;
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

function flowNode(id: string, title: string, subtitle: string, x: number, y: number, active: boolean, color = "#317f6d"): Node {
  return {
    id,
    position: { x, y },
    data: {
      label: (
        <div className={active ? "flow-node active" : "flow-node"} style={active ? { borderColor: color } : undefined}>
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
      )
    },
    style: { border: "none", background: "transparent", padding: 0, width: 165 }
  };
}

function flowEdge(id: string, source: string, target: string, active: boolean, feedback = false): Edge {
  return {
    id,
    source,
    target,
    animated: active,
    type: feedback ? "smoothstep" : "default",
    markerEnd: { type: MarkerType.ArrowClosed, color: active ? "#26876d" : "#9aa8b8" },
    style: { stroke: active ? "#26876d" : "#9aa8b8", strokeWidth: active ? 3 : 2 }
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
      name: "hours",
      nameTextStyle: { color: "#8fa7a0" },
      axisLine: { lineStyle: { color: "rgba(128, 169, 158, 0.34)" } },
      axisTick: { lineStyle: { color: "rgba(128, 169, 158, 0.28)" } },
      axisLabel: { color: "#8fa7a0" },
      splitLine: { lineStyle: { color: "rgba(128, 169, 158, 0.14)" } }
    },
    series: [
      { name: "p10", type: "line", smooth: true, showSymbol: false, data: history.map((p) => p.rulP10) },
      { name: "p50", type: "line", smooth: true, showSymbol: false, lineStyle: { width: 3 }, data: history.map((p) => p.rulP50) },
      { name: "p90", type: "line", smooth: true, showSymbol: false, data: history.map((p) => p.rulP90) }
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
