import { useEffect, useRef, useState } from 'react';
import { Download, Play, ShieldCheck } from 'lucide-react';
import type { OntologySnapshot } from './model';
import { rulBandLabel } from '../model/xgboost';
import { executeWtSemantic, semanticQuestions, type WtDefect } from './wtSemantic';

type Result = Awaited<ReturnType<typeof executeWtSemantic>> & { key: string; snapshot: OntologySnapshot };
export default function WtSemanticWorkbench({ snapshot, onPause }: { snapshot: OntologySnapshot; onPause: () => void }) {
  const [question, setQuestion] = useState('evidence');
  const [defect, setDefect] = useState<WtDefect>('none');
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);
  const key = JSON.stringify([snapshot, question, defect]);
  const current = result?.key === key ? result : null;
  async function run() {
    onPause(); setBusy(true); setError(''); setResult(null);
    const id = ++request.current, captured = structuredClone(snapshot), runKey = key;
    try {
      const load = async (path: string) => { const response = await fetch(`${import.meta.env.BASE_URL}ontology/${path}`); if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`); return response.text(); };
      const [shapes, query] = await Promise.all([load('wt-shapes.ttl'), load(`queries/wt-${question}.rq`)]);
      const executed = await executeWtSemantic(captured, shapes, query, defect);
      if (id === request.current) setResult({ ...executed, key: runKey, snapshot: captured });
    } catch (e) { if (id === request.current) setError(e instanceof Error ? e.message : String(e)); }
    finally { if (id === request.current) setBusy(false); }
  }
  function download(kind: 'dataset' | 'report' | 'evidence') {
    if (!current) return;
    const text = kind === 'dataset' ? current.datasetTTL : kind === 'report' ? current.reportTTL : JSON.stringify(current, null, 2);
    const url = URL.createObjectURL(new Blob([text], { type: kind === 'evidence' ? 'application/json' : 'text/turtle' }));
    const a = document.createElement('a'); a.href = url; a.download = `wt-semantic-${kind}.${kind === 'evidence' ? 'json' : 'ttl'}`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const preferred = question === 'features' ? ['name', 'value', 'source'] : ['asset', 'service', 'lower', 'point', 'upper', 'model', 'featureSource', 'cost', 'risk'];
  const keys = current?.rows.length ? Object.keys(current.rows[0]) : [];
  const columns = [...preferred.filter(c => keys.includes(c)), ...keys.filter(c => !preferred.includes(c))];
  const [lower, , upper] = rulBandLabel(current?.snapshot.reading ?? snapshot.reading).split(' / ');
  const headings: Record<string, string> = { lower: `${lower} / pseudo-h`, point: 'P50 / pseudo-h', upper: `${upper} / pseudo-h`, cost: 'Assumed GBP', risk: 'Risk index' };
  const display = (column: string, value: string) => ['lower', 'point', 'upper', 'cost', 'risk', 'value'].includes(column) && Number.isFinite(Number(value)) ? Number(value).toLocaleString('en-GB', { maximumFractionDigits: 3 }) : value;
  return <section className="wt-semantic" aria-label="WT executable semantic validation">
    <div className="research-heading"><h3>WT Semantic Check</h3><span>Application profile 1.0 / captured evidence</span></div>
    <div className="research-controls">
      <label>Evidence question<select aria-label="WT semantic question" value={question} onChange={e => setQuestion(e.target.value)}>{semanticQuestions.map(q => <option key={q.id} value={q.id}>{q.label}</option>)}</select></label>
      <label>Validation case<select aria-label="WT validation case" value={defect} onChange={e => setDefect(e.target.value as WtDefect)}><option value="none">Captured snapshot</option><option value="missing-unit">Test copy: missing pseudo-hour unit</option><option value="missing-evidence">Test copy: missing estimate link</option></select></label>
      <button onClick={run} disabled={busy}><Play size={15} />{busy ? 'Executing' : 'Run RDF / SHACL / SPARQL'}</button>
    </div>
    <p className="research-scope">{snapshot.asset} / {snapshot.reading.t} / {snapshot.reading.rulEvidence?.featureSource ?? 'legacy'} / synthetic pseudo-hours{defect !== 'none' ? ' / modified test copy only' : ''}</p>
    <div aria-live="polite">
      {error && <p role="alert" className="research-warning">Semantic execution failed: {error}</p>}
      {!current && !error && <p className="research-scope">{result ? 'Selection changed; previous results are not current.' : 'No check recorded for this selection.'}</p>}
      {current && <>
        <div className={`research-status ${current.conforms ? 'pass' : 'fail'}`}><ShieldCheck size={20} /><strong data-testid="wt-shacl-result">{current.conforms ? 'CONFORMS / WT profile' : 'NON-CONFORMING / evidence or eligibility'}</strong><span>{current.triples} triples / {current.rows.length} query rows / {current.violations.length} violations</span></div>
        {current.violations.map((v, i) => <p className="research-warning" key={i}>{v.path.replace('https://w3id.org/sdt-wt/demo#', 'wt:')}: {v.message}</p>)}
        <div className="research-table-wrap"><table aria-label="WT SPARQL results"><thead><tr>{columns.map(c => <th key={c}>{headings[c] ?? c}</th>)}</tr></thead><tbody>{current.rows.map((row, i) => <tr key={i}>{columns.map(c => <td key={c}>{display(c, row[c])}</td>)}</tr>)}</tbody></table>{!current.rows.length && <p className="research-scope">No matching rows; missing links/units or unavailable full features.</p>}</div>
        <details><summary>Executed query and scope</summary><pre>{current.query}</pre><p>{current.scope}</p><code>RDF SHA-256 {current.datasetSHA256}</code></details>
        <div className="research-controls">{(['dataset', 'report', 'evidence'] as const).map(kind => <button key={kind} onClick={() => download(kind)}><Download size={15} />{{ dataset: 'RDF snapshot', report: 'SHACL report', evidence: 'Evidence + hashes' }[kind]}</button>)}</div>
      </>}
    </div>
    <p className="research-scope">Structural evidence checks, not physical RUL accuracy, cost optimality, full Chapter 4 conformance or OWL reasoning.</p>
    <div className="research-links"><a href={`${import.meta.env.BASE_URL}ontology/wt-profile.ttl`} download>WT profile</a><a href={`${import.meta.env.BASE_URL}ontology/wt-shapes.ttl`} download>Executed shapes</a></div>
  </section>;
}
