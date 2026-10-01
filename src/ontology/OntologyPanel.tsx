import { useEffect, useMemo, useState } from 'react';
import ReactFlow, { Background, Controls, Handle, MarkerType, Position, type NodeProps } from 'reactflow';
import { BookOpen, Download, Focus, GitBranch, History, Network, Pause, Play, Search } from 'lucide-react';
import schema from '../data/ontologySchema.json';
import { buildSemanticGraph, evidenceSource, updateExecutionLog, type OntologyExecution, type OntologySnapshot, type SemanticNode } from './model';
import './ontology.css';

const colors = { asset: '#7bc8ed', evidence: '#68d5b3', prediction: '#c5aff2', decision: '#f2cf7c', service: '#edacb2', contract: '#a8c9d8' };
type OntologyTab = 'live' | 'schema' | 'trace';
const tabs = [{ id: 'live' as const, label: 'Live Graph', icon: Network }, { id: 'schema' as const, label: 'Ontology Schema', icon: BookOpen }, { id: 'trace' as const, label: 'Decision Trace', icon: History }];

function EntityNode({ data, selected }: NodeProps<{ entity: SemanticNode }>) {
  const n = data.entity;
  return <div className={`semantic-node ${selected ? 'selected' : ''}`} style={{ borderColor: colors[n.group] }}>
    {[Position.Left, Position.Right, Position.Top, Position.Bottom].map((position) => <Handle key={`target-${position}`} id={`target-${position}`} type="target" position={position} />)}
    <div className="semantic-node-meta"><span style={{ color: colors[n.group] }}>{n.group}</span><span>{n.layer}</span></div>
    <strong>{n.title}</strong><span className="semantic-node-type" title={n.type}>{n.type}</span><small>{n.status}</small>
    {[Position.Left, Position.Right, Position.Top, Position.Bottom].map((position) => <Handle key={`source-${position}`} id={`source-${position}`} type="source" position={position} />)}
  </div>;
}
const nodeTypes = { entity: EntityNode };
const modules = [
  { label: 'Equipment', roots: ['sdt:Asset', 'sdt:Component', 'sdt:Sensor'] },
  { label: 'Material', roots: ['sdt:SparePart', 'sdt:Consumable'] },
  { label: 'Product & Contract', roots: ['sdt:ServiceOffering', 'sdt:Contract', 'sdt:ContractKPI', 'sdt:Obligation', 'sdt:PenaltyClause', 'sdt:SettlementRecord', 'sdt:ServiceActionRecommendation', 'sdt:FeedbackUpdateRecord'] },
  { label: 'Process', roots: ['sdt:ServiceProcess', 'sdt:ServiceStateTransition', 'sdt:KPISettlementProcess', 'sdt:MonitoringCampaign', 'sdt:ActionAuthorisation', 'sdt:ActionExecution', 'sdt:InterventionOutcomeAssessment', 'sdt:PostActionObservation'] },
  { label: 'Personnel', roots: ['sdt:StakeholderRole'] },
  { label: 'Facility', roots: ['sdt:OperatingSite', 'sdt:ServiceCenter', 'sdt:SparePartDepot'] },
  { label: 'Environment', roots: ['sdt:OperatingEnvironment'] },
  { label: 'Supporting Documents', roots: ['sdt:SupportingDocument'] }
];

function ancestry(id: string, visited = new Set<string>()): Set<string> {
  if (visited.has(id)) return visited;
  visited.add(id);
  schema.classes.find((cls) => cls.id === id)?.parents.forEach((parent) => ancestry(parent, visited));
  return visited;
}

function downloadGraph(snapshot: OntologySnapshot, execution?: OntologyExecution) {
  const blob = new Blob([JSON.stringify({ schemaVersion: schema.version, schemaSha256: schema.sha256, mapping: 'Dashboard projection; not reasoner output', snapshot, execution, graph: buildSemanticGraph(snapshot, execution) }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `ontology-${snapshot.id.replace(/[^a-z0-9_-]/gi, '_')}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function OntologyPanel({ snapshot, execution }: { snapshot: OntologySnapshot; execution: OntologyExecution | null }) {
  const [tab, setTab] = useState<OntologyTab>('live');
  const [selected, setSelected] = useState('recommendation');
  const [log, setLog] = useState<OntologyExecution[]>([]);
  const [eventId, setEventId] = useState('live');
  const [frozen, setFrozen] = useState<OntologySnapshot | null>(null);
  const [query, setQuery] = useState('');
  const [classId, setClassId] = useState('sdt:ServiceActionRecommendation');
  const [focused, setFocused] = useState(() => window.matchMedia('(max-width: 760px)').matches);
  useEffect(() => {
    if (execution) setLog((current) => updateExecutionLog(current, execution));
  }, [execution]);
  const event = log.find((entry) => entry.id === eventId);
  const current = event?.before ?? frozen ?? snapshot;
  const graph = useMemo(() => buildSemanticGraph(current, event), [current, event]);
  const inspected = graph.nodes.find((node) => node.id === selected) ?? graph.nodes[0];
  const neighbors = new Set(graph.relations.filter((edge) => edge.source === inspected.id || edge.target === inspected.id).flatMap((edge) => [edge.source, edge.target]));
  const visibleNodes = graph.nodes.filter((entity) => !focused || neighbors.has(entity.id) || entity.id === inspected.id);
  const nodes = visibleNodes.map((entity, index) => ({ id: entity.id, type: 'entity', position: focused ? { x: (index % 2) * 245, y: Math.floor(index / 2) * 175 } : { x: entity.x, y: entity.y }, data: { entity }, selected: entity.id === inspected.id, style: { opacity: focused || neighbors.has(entity.id) || entity.id === inspected.id ? 1 : 0.72 }, ariaLabel: `${entity.title}, ${entity.type}` }));
  const edges = graph.relations.filter((edge) => nodes.some((node) => node.id === edge.source) && nodes.some((node) => node.id === edge.target)).map((edge, index) => {
    const active = edge.source === inspected.id || edge.target === inspected.id;
    const from = nodes.find((node) => node.id === edge.source)!.position;
    const to = nodes.find((node) => node.id === edge.target)!.position;
    let sourceSide = to.x >= from.x ? 'right' : 'left';
    let targetSide = to.x >= from.x ? 'left' : 'right';
    if (to.x === from.x) {
      if (Math.abs(to.y - from.y) > 175) { sourceSide = 'right'; targetSide = 'right'; }
      else { sourceSide = to.y > from.y ? 'bottom' : 'top'; targetSide = to.y > from.y ? 'top' : 'bottom'; }
    } else if (to.y === from.y) {
      sourceSide = from.y === 0 ? 'top' : 'bottom'; targetSide = sourceSide;
    }
    return { id: `relation-${index}`, source: edge.source, target: edge.target, sourceHandle: `source-${sourceSide}`, targetHandle: `target-${targetSide}`, label: active ? edge.predicate : undefined, type: 'smoothstep', pathOptions: { offset: 18 }, markerEnd: { type: MarkerType.ArrowClosed, color: active ? '#f2cf7c' : '#54756e' }, style: { stroke: active ? '#f2cf7c' : '#54756e', strokeWidth: active ? 1.8 : 1, opacity: active ? 1 : 0.35 }, labelStyle: { fill: '#f8dfa6', fontSize: 10 }, labelBgStyle: { fill: '#101918', fillOpacity: 0.95 }, labelBgPadding: [4, 3] as [number, number], labelBgBorderRadius: 2 };
  });
  const selectedClass = schema.classes.find((cls) => cls.id === classId)!;
  const matches = schema.classes.filter((cls) => `${cls.label} ${cls.id} ${cls.description}`.toLowerCase().includes(query.toLowerCase()));
  const groups = [...modules, { label: 'Condition & Prognostics', roots: [] as string[] }].map((module) => ({
    ...module,
    classes: matches.filter((cls) => {
      const parentIds = ancestry(cls.id);
      const assigned = modules.find((group) => group.roots.some((root) => parentIds.has(root)));
      return assigned ? assigned.label === module.label : module.label === 'Condition & Prognostics';
    })
  }));
  const traceEvent = event ?? log[0];
  return <section className="ontology-workspace" aria-label="Ontology and decision evidence">
    <div className="ontology-heading"><div><div className="section-title"><Network size={18} /><h2>Ontology & Decision Evidence</h2></div><span className="ontology-subtitle">{schema.counts.classes} classes · {schema.counts.objectProperties} relationships · {schema.counts.dataProperties} data properties</span></div><div className="ontology-source-tag">SDT v{schema.version}<span>Chapter 4</span></div></div>
    <div className="ontology-toolbar">
      <div className="ontology-tabs" role="tablist" aria-label="Ontology views">{tabs.map(({ id, label, icon: Icon }) => <button key={id} id={`ontology-tab-${id}`} role="tab" type="button" aria-selected={tab === id} aria-controls={`ontology-view-${id}`} onClick={() => setTab(id)}><Icon size={15} /><span>{label}</span></button>)}</div>
      <div className="ontology-tools">
        {tab === 'live' && <button className="ontology-icon" title="Focus selected entity and neighbors" aria-label="Focus selected entity and neighbors" aria-pressed={focused} onClick={() => setFocused(!focused)}><Focus size={16} /></button>}
        {tab === 'live' && <><label className="ontology-event-select"><span>Evidence</span><select aria-label="Graph evidence snapshot" value={eventId} onChange={(e) => { setEventId(e.target.value); setFrozen(null); }}><option value="live">Current readings</option>{log.map((entry) => <option key={entry.id} value={entry.id}>{entry.before.reading.t} · {entry.label}</option>)}</select></label><button className="ontology-icon" title={frozen ? 'Resume live graph' : 'Freeze graph snapshot'} aria-label={frozen ? 'Resume live graph' : 'Freeze graph snapshot'} disabled={!!event} onClick={() => setFrozen(frozen ? null : structuredClone(snapshot))}>{frozen ? <Play size={16} /> : <Pause size={16} />}</button><button className="ontology-icon" title="Download evidence JSON" aria-label="Download evidence JSON" onClick={() => downloadGraph(current, event)}><Download size={16} /></button></>}
        {tab === 'schema' && <label className="ontology-search"><Search size={15} /><input aria-label="Search ontology classes" placeholder="Search classes" value={query} onChange={(e) => setQuery(e.target.value)} /></label>}
      </div>
    </div>

    {tab === 'live' && <div role="tabpanel" id="ontology-view-live" aria-labelledby="ontology-tab-live">
      <div className="ontology-context"><span className={`ontology-live-dot ${event || frozen ? 'paused' : ''}`} /><strong>{event ? 'Service event snapshot' : frozen ? 'Frozen snapshot' : 'Live projection'}</strong><span>{evidenceSource(current.reading)}</span><time>{current.reading.t}</time></div>
      <div className="ontology-content">
        <div className="ontology-canvas" data-testid="ontology-graph"><ReactFlow key={`${event ? 'event' : 'current'}-${focused ? inspected.id : 'all'}`} nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.12 }} minZoom={0.25} maxZoom={1.8} nodesDraggable={false} nodesConnectable={false} onNodeClick={(_, node) => setSelected(node.id)} attributionPosition="bottom-left"><Background color="#354b46" gap={24} /><Controls showInteractive={false} /></ReactFlow></div>
        <aside className="ontology-inspector" aria-label="Ontology entity details"><div className="ontology-inspector-head"><span style={{ color: colors[inspected.group] }}>{inspected.type}</span><h3>{inspected.title}</h3><span className="ontology-detail-status">{inspected.status}</span></div><dl>{inspected.fields.map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl><details><summary>Entity URI & relationships</summary><code>{inspected.uri}</code><ul className="ontology-relationships">{graph.relations.filter((edge) => edge.source === inspected.id || edge.target === inspected.id).map((edge, index) => {
          const target = edge.source === inspected.id ? edge.target : edge.source;
          return <li key={index}><span>{edge.source === inspected.id ? 'Outgoing' : 'Incoming'} · {edge.predicate}</span><button onClick={() => setSelected(target)}>{graph.nodes.find((node) => node.id === target)?.title}</button></li>;
        })}</ul></details></aside>
      </div>
      <div className="ontology-legend">{Object.entries(colors).map(([name, color]) => <span key={name}><i style={{ background: color }} />{name}</span>)}<span className="ontology-evidence-boundary">Mapped relationships · OWL / SHACL not run</span></div>
    </div>}

    {tab === 'schema' && <div role="tabpanel" id="ontology-view-schema" aria-labelledby="ontology-tab-schema" className="ontology-schema-layout">
      <div className="ontology-class-list"><div className="ontology-schema-summary"><strong>T-Box</strong><span>{matches.length} / {schema.counts.classes} classes</span></div>{groups.filter((group) => group.classes.length > 0).map((group) => <details key={group.label} open><summary>{group.label}<span>{group.classes.length}</span></summary><ul>{group.classes.map((cls) => <li key={cls.id}><button className={cls.id === classId ? 'active' : ''} onClick={() => setClassId(cls.id)}><GitBranch size={14} /><span>{cls.label}</span></button></li>)}</ul></details>)}{matches.length === 0 && <p className="ontology-empty">No matching classes.</p>}</div>
      <aside className="ontology-schema-detail"><span className="ontology-type-label">{selectedClass.id}</span><h3>{selectedClass.label}</h3><p>{selectedClass.description}</p><h4>Direct Superclasses</h4><ul className="ontology-parent-list">{selectedClass.parents.map((parent) => <li key={parent}>{schema.classes.some((cls) => cls.id === parent) ? <button onClick={() => setClassId(parent)}>{parent}</button> : <code>{parent}</code>}</li>)}</ul><h4>Applicable Properties</h4><div className="ontology-property-list">{schema.properties.filter((property) => property.domain.some((domain) => ancestry(classId).has(domain))).map((property) => <details key={property.id}><summary><span>{property.label}</span><small>{property.kind}</small></summary><p>{property.description}</p><dl><div><dt>Domain</dt><dd>{property.domain.join(', ')}</dd></div><div><dt>Range</dt><dd>{property.range.join(', ')}</dd></div></dl></details>)}</div><details className="ontology-source-details"><summary>Source & license</summary><code>{selectedClass.uri}</code><p>CC BY 4.0 · Jerry Ma · Chapter 4</p><p>SHA-256: <code>{schema.sha256}</code></p><a href={`${import.meta.env.BASE_URL}ontology/sdt_tbox.ttl`} download>Download T-Box (.ttl)</a><a href={`${import.meta.env.BASE_URL}ontology/sdt_shacl_shapes.ttl`} download>Download SHACL definitions (.ttl)</a><span>Definitions loaded; live validation not executed.</span></details></aside>
    </div>}

    {tab === 'trace' && <div role="tabpanel" id="ontology-view-trace" aria-labelledby="ontology-tab-trace" className="ontology-trace-layout">
      <div className="ontology-event-list"><div className="ontology-schema-summary"><strong>Session Events</strong><span>{log.length} / 30</span></div>{log.length === 0 ? <p className="ontology-empty">No service execution recorded in this session.</p> : log.map((entry) => <button key={entry.id} className={traceEvent?.id === entry.id ? 'active' : ''} onClick={() => setEventId(entry.id)}><span>{entry.before.reading.t} · {entry.status === 'completed' ? 'Completed' : 'In downtime'}</span><strong>{entry.label}</strong><small>{entry.before.serviceState} · {entry.downtimeH} h planned</small></button>)}</div>
      <div className="ontology-trace-detail">{traceEvent ? <><div className="ontology-trace-header"><div><span className="ontology-type-label">{traceEvent.id}</span><h3>{traceEvent.label}</h3></div><button onClick={() => { setEventId(traceEvent.id); setTab('live'); setSelected('execution'); }}><Network size={15} />View graph</button></div><ol className="ontology-lifecycle">
        <li className="complete"><strong>Evidence</strong><span>{traceEvent.before.reading.crackMm?.toFixed(1) ?? 'n/a'} mm · P10 {traceEvent.before.reading.rulP10} h</span></li>
        <li className="complete"><strong>Recommendation</strong><span>{traceEvent.before.recommendation.label}</span></li>
        <li className="pending"><strong>Authorisation</strong><span>Not recorded · auto demo policy</span></li>
        <li className={traceEvent.status === 'completed' ? 'complete' : 'active'}><strong>Execution</strong><span>{traceEvent.status} · {traceEvent.downtimeH} h planned</span></li>
        <li className={traceEvent.after ? 'complete' : 'pending'}><strong>Post-service observation</strong><span>{traceEvent.after ? 'Simulated result captured' : 'Pending completion'}</span></li>
        <li className="pending"><strong>Assessment & feedback</strong><span>Pending measured evidence</span></li>
      </ol><div className="ontology-before-after"><h4>Intervention Evidence</h4><table><thead><tr><th>Metric</th><th>Before</th><th>After</th></tr></thead><tbody><tr><th>Crack (mm)</th><td>{traceEvent.before.reading.crackMm?.toFixed(1) ?? 'n/a'}</td><td>{traceEvent.after?.reading.crackMm?.toFixed(1) ?? 'Pending'}</td></tr><tr><th>RUL P10 (h)</th><td>{traceEvent.before.reading.rulP10}</td><td>{traceEvent.after?.reading.rulP10 ?? 'Pending'}</td></tr><tr><th>Vibration RMS (g)</th><td>{traceEvent.before.reading.vibrationRms.toFixed(3)}</td><td>{traceEvent.after?.reading.vibrationRms.toFixed(3) ?? 'Pending'}</td></tr><tr><th>Service state</th><td>{traceEvent.before.serviceState}</td><td>{traceEvent.after?.serviceState ?? 'Pending'}</td></tr></tbody></table></div><p className="ontology-trace-boundary">Simulation event · outcome not confirmed by measured maintenance data · session history resets on reload</p></> : <div className="ontology-empty"><History size={28} /><p>Waiting for an automatic service event.</p></div>}</div>
    </div>}
  </section>;
}
