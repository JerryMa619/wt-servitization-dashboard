import { useEffect, useState } from 'react';
import { ArrowRight, Camera, Download, Network, Pause, Play, Radio, ShieldCheck, Trash2 } from 'lucide-react';
import type { OntologySnapshot } from './model';
import { mappingRows, recordExport, recordLimit, type DataRecord, type MappingRow } from './lineage';
import schema from '../data/ontologySchema.json';

function clock(value?: string) {
  if (!value) return 'Not supplied';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleTimeString('en-GB', { hour12: false });
}

export function MappingView({ snapshot, changes, onEntity }: { snapshot: OntologySnapshot; changes: string[]; onEntity: (nodeId: string) => void }) {
  const rows = mappingRows(snapshot);
  return <div className="dt-mapping-view">
    <div className="lineage-flow" aria-label="DT to ontology evidence flow">{['OME / asset', 'DCDCE / observation', 'DTE / analysis & policy', 'UE / service & contract'].map((label, i) => <div key={label}><span>{String(i + 1).padStart(2, '0')}</span><strong>{label}</strong>{i < 3 && <ArrowRight size={15} aria-hidden="true" />}</div>)}</div>
    <div className="lineage-caption"><span>Selected evidence frame: {snapshot.reading.t}</span><span>ISO 23247 research mapping / no additional ISO layer</span></div>
    <div className="lineage-table-scroll"><table className="lineage-table mapping-table"><caption className="lineage-sr-only">DT responsibilities, ontology entities, values and evidence sources</caption><thead><tr><th>DT responsibility</th><th>Ontology representation</th><th>Current value</th><th>Source / evidence</th></tr></thead><tbody>{rows.map(row => <tr key={row.id} className={changes.includes(row.id) ? 'lineage-changed' : ''}><td><span className="lineage-layer">{row.layer}</span><strong>{row.responsibility}</strong></td><td><button className="lineage-entity-link" onClick={() => onEntity(row.nodeId)} title={`Inspect ${row.label} in Live Graph`}><Network size={13} /><span>{row.entity}</span></button><small>{row.label}</small></td><td><strong>{row.value}</strong>{changes.includes(row.id) && <small className="lineage-update-label">Updated in latest capture</small>}</td><td><span>{row.source}</span><small>{row.evidence}</small></td></tr>)}</tbody></table></div>
    <p className="lineage-boundary">Responsibility mapping, not class equivalence or OWL inference. Cross-system provenance applies across every stage. Live Graph uses the Chapter 4 projection; Semantic Check materialises the separate WT RDF profile.</p>
  </div>;
}

function FieldSource({ row }: { row: MappingRow }) {
  return <div><dt>{row.label}</dt><dd><strong>{row.value}</strong><span>{row.layer} / {row.entity}</span><span>Source: {row.source}</span><small>{row.evidence}</small><code>{row.uri}</code></dd></div>;
}

export function RecordsView({ records, snapshot, sessionId, recording, paused, onRecording, onSimulation, onCapture, onClear, onInspect }: {
  records: DataRecord[]; snapshot: OntologySnapshot; sessionId: string; recording: boolean; paused: boolean;
  onRecording: () => void; onSimulation: () => void; onCapture: () => void; onClear: () => void;
  onInspect: (record: DataRecord, semantic: boolean) => void;
}) {
  const [pinnedRecord, setPinnedRecord] = useState<DataRecord | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { setPinnedRecord(null); setError(''); }, [sessionId]);
  const selected = pinnedRecord ?? records[0];
  async function download() {
    try {
      setError('');
      const payload = recordExport(records, sessionId, schema.sha256);
      const bytes = new TextEncoder().encode(JSON.stringify(payload));
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(v => v.toString(16).padStart(2, '0')).join('');
      const url = URL.createObjectURL(new Blob([JSON.stringify({ payload, payloadSHA256: hash }, null, 2)], { type: 'application/json' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `wt-data-records-${sessionId.replace(/[^a-z0-9_-]/gi, '_')}.json`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(e instanceof Error ? e.message : 'Data-record export failed'); }
  }
  return <div className="data-records-view">
    <div className="lineage-record-toolbar">
      <div className="lineage-record-state"><Radio size={15} /><strong>{recording ? 'Capture enabled' : 'Capture paused'}</strong><span>{records.length} / {recordLimit} retained</span></div>
      <div className="lineage-record-actions">
        <button onClick={onSimulation} title={paused ? 'Run WT simulation' : 'Pause WT simulation'}>{paused ? <Play size={15} /> : <Pause size={15} />}<span>{paused ? 'Run WT' : 'Pause WT'}</span></button>
        <button onClick={onRecording} title={recording ? 'Pause data capture' : 'Resume data capture'} aria-label={recording ? 'Pause data capture' : 'Resume data capture'} aria-pressed={recording}>{recording ? <Pause size={15} /> : <Play size={15} />}<span>Capture</span></button>
        <button onClick={onCapture} title="Capture current reading" aria-label="Capture current reading"><Camera size={15} /></button>
        <button onClick={() => void download()} disabled={!records.length} title="Export data records JSON" aria-label="Export data records JSON"><Download size={15} /></button>
        <button onClick={() => { onClear(); setPinnedRecord(null); }} disabled={!records.length} title="Clear captured records" aria-label="Clear captured records"><Trash2 size={15} /></button>
      </div>
    </div>
    <div className="lineage-caption"><span>{paused ? 'WT simulation paused' : 'Following WT updates'} / current frame {snapshot.reading.t}</span><span>Browser memory only / latest {recordLimit} frames / export before reload</span></div>
    {error && <p role="alert" className="lineage-error">{error}</p>}
    {!records.length ? <p className="ontology-empty">No captured records. Capture the current reading or resume capture and run WT.</p> : <div className="lineage-record-layout">
      <div className="lineage-record-list"><div className="lineage-list-heading"><strong>Captured frames</strong><button onClick={() => setPinnedRecord(null)} aria-pressed={!pinnedRecord}>Follow newest</button></div><div className="lineage-table-scroll"><table className="lineage-table"><thead><tr><th>Record / captured</th><th>Reading / origin</th><th>Updates</th></tr></thead><tbody>{records.map(record => <tr key={record.id} className={selected?.id === record.id ? 'lineage-selected' : ''}><td><button onClick={() => setPinnedRecord(structuredClone(record))} aria-label={`Inspect data record ${record.sequence}`} aria-pressed={selected?.id === record.id}>#{String(record.sequence).padStart(4, '0')}</button><small>{clock(record.recordedAt)}</small></td><td><span>{record.snapshot.reading.t}</span><small>{record.snapshot.reading.source ?? 'Fallback simulation'}</small><small>{record.snapshot.serviceState}</small></td><td><strong>{record.changes.length}</strong><small>{record.changes.map(id => record.rows.find(row => row.id === id)?.label).join(', ') || 'New reading / unchanged displayed values'}</small></td></tr>)}</tbody></table></div></div>
      {selected && <aside className="lineage-record-detail" aria-label="Captured record provenance"><div className="lineage-detail-header"><div><span>Immutable captured frame</span><h3>Record #{String(selected.sequence).padStart(4, '0')}</h3></div><div className="lineage-record-actions"><button onClick={() => onInspect(selected, false)} title="View captured record graph" aria-label="View captured record graph"><Network size={16} /></button><button onClick={() => onInspect(selected, true)} title="Validate captured record in Semantic Check" aria-label="Validate captured record in Semantic Check"><ShieldCheck size={16} /></button></div></div>
        {pinnedRecord && !records.some(record => record.id === pinnedRecord.id) && <p className="lineage-boundary">Pinned frame is outside the latest {recordLimit} records and is not included in the bulk export.</p>}
        <dl className="lineage-provenance-meta"><div><dt>Snapshot ID</dt><dd><code>{selected.snapshot.id}</code></dd></div><div><dt>Captured at (wall clock)</dt><dd>{selected.recordedAt}</dd></div><div><dt>Source reading time / observed / received</dt><dd>{selected.snapshot.reading.t}<span>{selected.snapshot.reading.observedAt ?? 'Observed timestamp not supplied'}</span><span>{selected.snapshot.reading.receivedAt ?? 'Received timestamp not supplied'}</span></dd></div><div><dt>Acquisition window / feature origin</dt><dd>{selected.snapshot.reading.acquisitionIndex ?? 'Not supplied'} / {selected.snapshot.reading.rulEvidence?.featureSource ?? 'Not supplied'}</dd></div></dl>
        <details open><summary>Values, ontology entities & sources</summary><dl className="lineage-field-sources">{selected.rows.map(row => <FieldSource key={row.id} row={row} />)}</dl></details>
      </aside>}
    </div>}
    <p className="lineage-boundary">Capture follows accepted dashboard frames, including modeled downtime and post-service updates. It is not raw hardware logging. Repeated capture of an identical frame is deduplicated; new sessions clear this buffer. Recording does not alter the model or service policy.</p>
  </div>;
}
