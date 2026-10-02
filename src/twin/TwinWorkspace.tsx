import { useEffect, useMemo, useState, type ReactNode } from 'react';
import ReactFlow, { Background, Handle, MarkerType, Position, useNodesState, type NodeProps, type Edge, type Node } from 'reactflow';
import { ArrowUpRight, ChevronLeft, ChevronRight, Database, History, Layers, Network, Pause, Play, Radio, RotateCcw, ShieldCheck, Wind } from 'lucide-react';
import { evidenceSource, type OntologyExecution, type OntologySnapshot } from '../ontology/model';
import { auxiliaryChannelReferences, bladeSensorFields, derivedConditionNote } from '../model/instrumentation';
import { rulDescription, rulUncertaintyDescription, rulModel } from '../model/xgboost';
import { activeConnections, activeModules, architectureModules, moduleValue, replayFrames, stageLabel, workflowStage, type ArchitectureModule, type ModuleId, type ReplayFrame } from './model';
import './twin.css';

export type ReplayRequest = { id: number; eventId: string };
type ModuleData = { module: ArchitectureModule; value: string; active: boolean; selected: boolean };

function ModuleNode({ data }: NodeProps<ModuleData>) {
  return <div className={`twin-module-node ${data.active ? 'active' : ''} ${data.selected ? 'selected' : ''}`}>
    {[Position.Left, Position.Right, Position.Top, Position.Bottom].map((position) => <Handle key={`target-${position}`} id={`target-${position}`} type="target" position={position} />)}
    <span>{data.module.extension ? 'SERVITIZATION EXTENSION' : data.module.subEntity}</span>
    <strong>{data.module.title}</strong><small>{data.value}</small>
    {[Position.Left, Position.Right, Position.Top, Position.Bottom].map((position) => <Handle key={`source-${position}`} id={`source-${position}`} type="source" position={position} />)}
  </div>;
}
const nodeTypes = { module: ModuleNode, group: ({ data }: NodeProps) => <>{data.label}</> };
const relations = [
  ['collection', 'condition', 'Data', 'right', 'left'],
  ['collection', 'registry', '', 'top', 'left'],
  ['condition', 'rul', 'Model', 'bottom', 'bottom'],
  ['condition', 'state', '', 'bottom', 'top'],
  ['rul', 'tcs', '', 'bottom', 'top'],
  ['state', 'tcs', 'Risk filter', 'bottom', 'bottom'],
  ['tcs', 'recommendation', 'Proposal', 'right', 'left'],
  ['recommendation', 'execution', 'Auto demo', 'bottom', 'top'],
  ['authorisation', 'execution', '', 'right', 'right'],
  ['execution', 'control', 'Simulated hold', 'bottom', 'bottom'],
  ['execution', 'collection', 'Post-service', 'right', 'bottom'],
  ['registry', 'access', '', 'left', 'left'],
  ['execution', 'kpi', 'Reference only', 'bottom', 'top']
] as const;

function detailRows(id: ModuleId, snapshot: OntologySnapshot, event: OntologyExecution | null) {
  const p = snapshot.reading;
  const common = [{ label: 'Input source', value: evidenceSource(p) }, { label: 'Evidence time', value: p.t }];
  switch (id) {
    case 'condition': return [{ label: 'Inputs', value: `Z RMS ${p.vibrationRms.toFixed(3)} g / Z kurtosis ${p.kurtosis.toFixed(2)} / f1 ${p.modalF1.toFixed(2)} Hz` }, { label: 'Condition', value: `${p.crackState ?? 'C?'} / ${p.crackMm?.toFixed(1) ?? 'n/a'} mm` }, ...common];
    case 'rul': return [{ label: 'Estimate P10 / P50 / P90', value: `${p.rulP10} / ${p.rulP50} / ${p.rulP90} pseudo-h` }, { label: 'Model / feature source', value: rulDescription(p) }, { label: 'Model version', value: p.modelVersion ?? 'Legacy replay' }, { label: 'Model configuration', value: p.modelVersion === rulModel.version ? '31 features / 300 trees per quantile / depth 6 / rate 0.05 / seed 42 / initial prediction 500' : 'Historical record retained / not recalculated by active XGBoost' }, { label: 'Validation scope', value: p.modelVersion === rulModel.version ? '189 training / 63 calibration / 63 test source windows; not measured hours-to-failure' : 'Historical model scope; current calibration/test results do not apply' }, { label: 'Uncertainty', value: rulUncertaintyDescription(p) }, { label: 'Outside training range', value: p.rulEvidence?.outsideTraining.join(', ') || 'None recorded' }, ...common];
    case 'tcs':
    case 'recommendation': return [{ label: 'Recommendation', value: snapshot.recommendation.label }, { label: 'Selection', value: snapshot.recommendation.acceptable ? 'Lowest TCS passing the residual-risk policy' : 'No candidate passed; minimum-cost fallback' }, ...snapshot.recommendation.costs.map((cost) => ({ label: cost.label, value: `GBP ${cost.value.toLocaleString('en-GB')}` }))];
    case 'execution': return [{ label: 'Event', value: event?.id ?? 'No current execution' }, { label: 'Planned downtime', value: event ? `${event.downtimeH} h / compressed simulation time` : 'Not started' }, { label: 'Outcome', value: 'Simulated readings; measured assessment pending' }];
    case 'control': return [{ label: 'Control output', value: p.serviceMode === 'in-downtime' ? 'Simulation sets rotor RPM and power targets to zero' : 'No current hold command' }, { label: 'Device connection', value: 'No physical actuator connected' }];
    case 'authorisation': return [{ label: 'Human authorisation', value: 'Not recorded' }, { label: 'Simulator', value: 'Automatic demonstration policy executes eligible maintenance' }];
    case 'kpi': return [{ label: 'Contract target', value: snapshot.contract ? `${(snapshot.contract.target * 100).toFixed(1)}%` : 'Unavailable' }, { label: 'Reference availability', value: snapshot.contract ? `${(snapshot.contract.actual * 100).toFixed(1)}%` : 'Unavailable' }, { label: 'Scope', value: 'Chapter 5 reference; not recalculated from this simulated intervention' }];
    case 'registry': return [{ label: 'Asset / component', value: `${snapshot.asset} / ${snapshot.component}` }, { label: 'State', value: snapshot.serviceState }, { label: 'Coordinates', value: `${snapshot.position.lat.toFixed(5)}, ${snapshot.position.lon.toFixed(5)} / ${snapshot.position.source}` }];
    case 'access': return [{ label: 'Representation', value: 'Chapter 4 SDT schema / shared event records' }, { label: 'Validation', value: 'Live OWL / SHACL not run' }, { label: 'Persistence', value: 'Latest 30 events saved in this browser; history JSON import / export' }];
    default: return [{ label: 'Observation', value: `${p.vibrationRms.toFixed(3)} g / wind ${p.windSpeed.toFixed(1)} m/s / ${p.windDirection} deg` }, ...bladeSensorFields, ...auxiliaryChannelReferences, { label: 'Auxiliary source', value: 'Chapter 5 commissioning plan / not live hardware' }, { label: 'Derived outputs', value: derivedConditionNote }, ...common];
  }
}

export default function TwinWorkspace({ snapshot, executions, activeExecution, request, renderTurbine, onOntology: navigateOntology, onCosts }: {
  snapshot: OntologySnapshot;
  executions: OntologyExecution[];
  activeExecution: OntologyExecution | null;
  request: ReplayRequest | null;
  renderTurbine: (snapshot: OntologySnapshot, select: (id: ModuleId) => void, selected: ModuleId) => ReactNode;
  onOntology: (node: string, eventId: string, snapshot?: OntologySnapshot, execution?: OntologyExecution) => void;
  onCosts: () => void;
}) {
  const [overlay, setOverlay] = useState(true);
  const [selected, setSelected] = useState<ModuleId>('condition');
  const [replay, setReplay] = useState<OntologyExecution | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const frames = useMemo(() => replay ? replayFrames(replay) : [], [replay]);
  function startReplay(event: OntologyExecution) {
    setReplay(structuredClone(event));
    setFrameIndex(0);
    setPlaying(false);
    setOverlay(true);
  }
  useEffect(() => {
    if (!request) return;
    if (request.eventId === 'live') { setReplay(null); setPlaying(false); setFrameIndex(0); return; }
    const event = executions.find((entry) => entry.id === request.eventId);
    if (event) startReplay(event);
  }, [request]);
  useEffect(() => {
    if (!playing || frames.length === 0) return;
    const timer = window.setInterval(() => setFrameIndex((index) => {
      if (index >= frames.length - 1) return index;
      return index + 1;
    }), 1200);
    return () => window.clearInterval(timer);
  }, [playing, frames.length]);
  useEffect(() => { if (frameIndex >= frames.length - 1) setPlaying(false); }, [frameIndex, frames.length]);
  const frame: ReplayFrame | undefined = frames[frameIndex];
  const view = frame?.snapshot ?? snapshot;
  const stage = frame?.stage ?? workflowStage(snapshot);
  const event = replay ?? (stage === 'downtime' || stage === 'result' ? activeExecution : null);
  // During an intervention, its proposal stays anchored to the captured pre-service evidence.
  const decisionView = event && (stage === 'downtime' || stage === 'result') ? event.before : view;
  const active = activeModules(stage);
  const connections = activeConnections(stage);
  const selection = architectureModules.find((module) => module.id === selected)!;
  const decisionModule = ['tcs', 'recommendation'].includes(selected);
  const inspected = decisionModule ? decisionView : view;
  const progressH = frame?.elapsedH ?? event?.progress?.elapsedH ?? 0;
  const progress = event ? Math.min(100, (progressH / Math.max(0.1, event.downtimeH)) * 100) : 0;
  const streaming = !replay && view.reading.source !== 'manual-input';
  function selectModule(id: ModuleId) { setSelected(id); setOverlay(true); }
  function onOntology(node: string, eventId: string) {
    const evidence = replay ? view : stage === 'result' ? event?.after : stage === 'downtime' ? event?.during?.[event.during.length - 1] : undefined;
    navigateOntology(node, event?.id ?? eventId, evidence, event ?? undefined);
  }
  const renderedNodes = useMemo<Node[]>(() => [
    { id: 'dcdce', type: 'group', position: { x: 0, y: 0 }, data: { label: <div className="twin-zone-label"><b>DCDCE</b><span>Acquisition & device control</span></div> }, style: { width: 188, height: 538, borderColor: '#557d88' }, selectable: false, focusable: false },
    { id: 'dte', type: 'group', position: { x: 210, y: 0 }, data: { label: <div className="twin-zone-label"><b>DTE</b><span>Digital twin core</span></div> }, style: { width: 390, height: 538, borderColor: '#76978b' }, selectable: false, focusable: false },
    { id: 'ue', type: 'group', position: { x: 622, y: 0 }, data: { label: <div className="twin-zone-label"><b>UE</b><span>Service & contract interface</span></div> }, style: { width: 198, height: 538, borderColor: '#ad9568' }, selectable: false, focusable: false },
    ...architectureModules.map((module) => ({ id: module.id, type: 'module', parentNode: module.entity, extent: 'parent' as const, position: { x: module.x, y: module.y }, data: { module, value: moduleValue(module.id, ['tcs', 'recommendation'].includes(module.id) ? decisionView : view, event, stage), active: active.includes(module.id), selected: module.id === selected }, style: { width: module.width, height: module.height }, ariaLabel: `${module.title}, ${module.subEntity}` }))
  ], [view, decisionView, event, selected, stage]);
  useEffect(() => {
    // Live data replaces node definitions; retain ReactFlow's measured dimensions.
    setNodes((current) => {
      const measured = new Map(current.map((node) => [node.id, node]));
      return renderedNodes.map((node) => ({ ...node, width: measured.get(node.id)?.width, height: measured.get(node.id)?.height }));
    });
  }, [renderedNodes, setNodes]);
  const edges: Edge[] = relations.map(([source, target, label, from, to], index) => {
    const highlighted = connections.some(([from, to]) => from === source && to === target);
    const pending = source === 'authorisation' || target === 'kpi';
    return { id: `workflow-${index}`, source, target, sourceHandle: `source-${from}`, targetHandle: `target-${to}`, label: highlighted ? label : undefined, className: highlighted ? 'twin-flow-active' : undefined, animated: highlighted && (streaming || playing), type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, color: highlighted ? '#f3d18b' : '#60776c' }, style: { stroke: highlighted ? '#f3d18b' : '#60776c', strokeWidth: highlighted ? 2 : 1, strokeDasharray: pending ? '4 4' : undefined, opacity: pending ? 0.4 : highlighted ? 1 : 0.6 }, labelStyle: { fill: '#e8d6a4', fontSize: 10 }, labelBgStyle: { fill: '#102019' }, labelBgPadding: [5, 3] };
  });
  return <section className={`twin-workspace ${overlay ? 'architecture-open' : ''} ${replay ? 'replay-mode' : ''}`} aria-label="Integrated wind turbine digital twin" id="twin-workspace" data-workflow-stage={stage}>
    <header className="twin-heading"><div className="section-title"><Wind size={19} /><h2>WT Operation & Digital Twin</h2></div><div className="twin-view-controls"><span className="twin-mode"><Radio size={13} />{replay ? 'EVENT REPLAY' : 'LIVE VIEW'}</span><label className="twin-toggle"><Layers size={15} /><span>Architecture overlay</span><input type="checkbox" role="switch" aria-label="Architecture overlay" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} /><i /></label></div></header>
    <div className="twin-replay-toolbar"><label><History size={15} /><select aria-label="Wind turbine event replay" value={replay?.id ?? 'live'} onChange={(e) => { if (e.target.value === 'live') { setReplay(null); setPlaying(false); } else { const event = executions.find((entry) => entry.id === e.target.value); if (event) startReplay(event); } }}><option value="live">Current operation</option>{replay && !executions.some((entry) => entry.id === replay.id) && <option value={replay.id}>Pinned / {replay.label} / {replay.status}</option>}{executions.map((entry) => <option key={entry.id} value={entry.id}>{entry.before.reading.t} / {entry.label} / {entry.status}</option>)}</select></label><span className="twin-stage-label">{stageLabel(stage)}</span>{replay && <><button title="Return to live operation" aria-label="Return to live operation" onClick={() => { setReplay(null); setPlaying(false); }}><RotateCcw size={16} /></button><span className="twin-replay-boundary">Historical snapshot / live simulation continues</span></>}</div>
    <div className="twin-body">
      <div className="twin-physical"><div className="twin-entity-caption"><b>OME</b><span>{view.asset} / {view.component}</span><time>{view.reading.t}</time></div>{renderTurbine(view, selectModule, selected)}<div className="twin-physical-evidence"><span>{evidenceSource(view.reading)}</span><span>State <b>{view.serviceState}</b></span><button onClick={() => onOntology('condition', replay?.id ?? 'live')}><Network size={14} />Blade evidence<ArrowUpRight size={12} /></button></div></div>
      {overlay ? <div className="twin-digital"><div className="twin-architecture-canvas" data-testid="twin-architecture"><ReactFlow style={{ width: 860, height: 580 }} nodes={nodes} onNodesChange={onNodesChange} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.045 }} nodesDraggable={false} nodesConnectable={false} zoomOnScroll={false} panOnDrag={false} preventScrolling={false} onNodeClick={(_, node) => { if (architectureModules.some((module) => module.id === node.id)) setSelected(node.id as ModuleId); }} attributionPosition="bottom-left"><Background gap={22} color="#263e35" /></ReactFlow></div><div className="twin-module-detail" aria-label="Architecture module details"><div className="twin-detail-title"><div><span>{selection.subEntity}{selection.extension ? ' / research extension' : ''}</span><h3>{selection.title}</h3></div>{selection.ontologyNode && <button onClick={() => onOntology(selection.ontologyNode!, replay?.id ?? 'live')}><Network size={14} />Ontology<ArrowUpRight size={12} /></button>}</div><dl>{detailRows(selected, inspected, event).map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl></div></div> : <div className="twin-operation-summary"><span className="twin-summary-label">OPERATING EVIDENCE</span><dl><div><dt>Wind speed / direction</dt><dd>{view.reading.windSpeed.toFixed(1)} m/s / {view.reading.windDirection} deg</dd></div><div><dt>RUL P10 / P50 / P90</dt><dd>{view.reading.rulP10} / {view.reading.rulP50} / {view.reading.rulP90} h</dd></div><div><dt>Vibration RMS</dt><dd>{view.reading.vibrationRms.toFixed(3)} g</dd></div></dl><div className="twin-proposal"><span>{event ? 'Captured intervention proposal' : 'Current service recommendation'}</span><strong>{decisionView.recommendation.label}</strong><b>GBP {decisionView.recommendation.totalCost.toLocaleString('en-GB')}</b><small>{decisionView.recommendation.acceptable ? 'Residual-risk filter passed' : 'Minimum-cost fallback / risk filter not passed'}</small><button onClick={() => selectModule('tcs')}><Layers size={15} />Decision path</button></div></div>}
    </div>
    {replay && <div className="twin-replay-player" aria-label="Service event replay controls"><button title="Previous recorded step" aria-label="Previous recorded step" disabled={frameIndex === 0} onClick={() => { setPlaying(false); setFrameIndex(Math.max(0, frameIndex - 1)); }}><ChevronLeft size={17} /></button><button title={playing ? 'Pause event replay' : 'Play event replay'} aria-label={playing ? 'Pause event replay' : 'Play event replay'} onClick={() => { if (!playing && frameIndex === frames.length - 1) setFrameIndex(0); setPlaying(!playing); }}>{playing ? <Pause size={17} /> : <Play size={17} />}</button><input type="range" aria-label="Recorded replay step" min={0} max={Math.max(0, frames.length - 1)} value={frameIndex} onChange={(e) => { setPlaying(false); setFrameIndex(Number(e.target.value)); }} /><button title="Next recorded step" aria-label="Next recorded step" disabled={frameIndex >= frames.length - 1} onClick={() => { setPlaying(false); setFrameIndex(Math.min(frames.length - 1, frameIndex + 1)); }}><ChevronRight size={17} /></button><span>{frameIndex + 1} / {frames.length} · {frame?.label}</span></div>}
    <div className="twin-service-loop"><div><span>SERVICE</span><strong>{event ? event.label : 'Advisory / monitoring'}</strong></div><div><span>AUTHORISATION</span><strong>Not recorded</strong></div><div><span>EXECUTION</span><strong>{event?.status === 'interrupted' ? 'Interrupted / no repair result' : stage === 'downtime' ? 'Simulated downtime' : stage === 'result' ? 'Simulated completion' : 'No current intervention'}</strong></div><div className="twin-downtime"><span>MODELED DOWNTIME</span><strong>{event ? `${progressH.toFixed(1)} / ${event.downtimeH.toFixed(1)} h` : '0.0 h current'}</strong><progress aria-label="Modeled service downtime" max={100} value={progress} /></div><div><span>ASSESSMENT</span><strong>Pending measured evidence</strong></div></div>
    {overlay && <div className="twin-cross-system"><div><ShieldCheck size={16} /><b>CSE</b><span>Cross-System Entity</span></div><span><b>Translation</b>SDT projection</span><span><b>Assurance</b>Source & event provenance</span><span><b>Security</b>Physical system not connected</span><button onClick={() => onOntology('rul', replay?.id ?? 'live')}><Database size={14} />Evidence trace<ArrowUpRight size={12} /></button></div>}
    {overlay && <div className="twin-architecture-note"><span>ISO 23247 structure / Chapter 3 servitization extensions</span><span>Simulated control · assessment pending · KPI is dataset reference</span>{!replay && <button onClick={onCosts}>TCS comparison<ArrowUpRight size={12} /></button>}</div>}
  </section>;
}
