import { useRef, useState } from 'react';
import { Download, Play, ShieldCheck } from 'lucide-react';
import { compact, executeSemantic, type Defect, type SemanticInput } from './semantic';

const base = (import.meta as unknown as { env: { BASE_URL: string } }).env.BASE_URL;
const queries = [
  { id: 'evidence', label: 'Why this recommendation?' },
  { id: 'candidates', label: 'Which alternatives are eligible?' },
  { id: 'observations', label: 'Which observations and source support it?' },
  { id: 'contract', label: 'What contract and KPI budget govern this advice?' }
];
type Result = Awaited<ReturnType<typeof executeSemantic>> & { key: string; engine: number; cycle: number; shapesSHA256: string; datasetSHA256: string };
export default function SemanticWorkbench({ input, onPause }: { input: SemanticInput; onPause: () => void }) {
  const [queryId,setQueryId] = useState('evidence');
  const [defect,setDefect] = useState<Defect>('none');
  const [result,setResult] = useState<Result | null>(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const request = useRef(0);
  const key = JSON.stringify([input,queryId,defect]);
  const current = result?.key === key ? result : null;
  async function run() {
    onPause(); setBusy(true); setError(''); setResult(null);
    const id = ++request.current;
    try {
      const load = async (path: string) => {
        const response = await fetch(`${base}cmapss/${path}`);
        if (!response.ok) throw new Error(`Unable to load ${path}: ${response.status}`);
        return response.text();
      };
      const [shapes,query] = await Promise.all([load('cmapss-shapes.ttl'),load(`queries/${queryId}.rq`)]);
      const executed = await executeSemantic(input,shapes,query,defect);
      const sha = async (text:string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(x=>x.toString(16).padStart(2,'0')).join('');
      const [shapesSHA256,datasetSHA256] = await Promise.all([sha(shapes),sha(executed.datasetTTL)]);
      if(id===request.current) setResult({...executed,key,engine:input.engine,cycle:input.point.cycle,shapesSHA256,datasetSHA256});
    } catch(e) { if(id===request.current) setError(e instanceof Error ? e.message : String(e)); }
    finally { if(id===request.current) setBusy(false); }
  }
  function download(kind: 'dataset' | 'report' | 'query' | 'results') {
    if(!current) return;
    const values = { dataset:current.datasetTTL, report:current.reportTTL, query:current.query,
      results:JSON.stringify({engine:current.engine,cycle:current.cycle,conforms:current.conforms,defect:current.defect,scope:current.scope,shapesSHA256:current.shapesSHA256,datasetSHA256:current.datasetSHA256,query:current.query,rows:current.rows,violations:current.violations},null,2) };
    const extension = kind==='query'?'rq':kind==='results'?'json':'ttl';
    const url=URL.createObjectURL(new Blob([values[kind]],{type:extension==='json'?'application/json':'text/plain'}));
    const a=document.createElement('a');a.href=url;a.download=`cmapss-${current.engine}-${current.cycle}-${kind}.${extension}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const columns = current?.rows.length ? Object.keys(current.rows[0]) : [];
  const display = (v:string) => /^-?\d+\.\d+$/.test(v) ? String(Number(v)) : compact(v);
  return <section className="cm-semantic" aria-label="Executable semantic workflow">
    <div className="cm-semantic-intro"><div><h3>Execute against this snapshot</h3><p>Generate RDF → run SHACL Core → execute SPARQL. All three steps run locally in your browser for the current engine, cycle and scenario.</p></div><span className="cm-pill">Application profile v0.3.0</span></div>
    <p className="cm-caption">Contract: {input.contract?.name??'Baseline/custom policy; apply a named contract in Service decisions to query its KPI budget.'}</p>
    <div className="cm-semantic-controls">
      <label>Evidence question<select aria-label="Semantic query" value={queryId} onChange={e=>setQueryId(e.target.value)}>{queries.map(q=><option key={q.id} value={q.id}>{q.label}</option>)}</select></label>
      <label>Validation example<select aria-label="Validation example" value={defect} onChange={e=>setDefect(e.target.value as Defect)}><option value="none">Current snapshot</option><option value="missing-unit">Test copy: remove cycle unit</option><option value="missing-evidence">Test copy: remove recommendation evidence link</option></select></label>
      <button className="cm-button cm-run" onClick={run} disabled={busy}><Play size={15}/>{busy?'Executing…':'Run RDF / SHACL / SPARQL'}</button>
    </div>
    {defect!=='none'&&<p className="cm-semantic-warning">Fault injection affects a test copy only. It does not alter the original dataset, prediction or current service advice.</p>}
    <div aria-live="polite">
      {error&&<p role="alert">Semantic execution failed: {error}</p>}
      {!current&&!error&&<p className="cm-caption">{result?'Snapshot, question or test case changed. Run again; previous results are not valid for this selection.':'No semantic check has run for this selection yet. Playback pauses when you run the workflow.'}</p>}
      {current&&<>
        <div className={`cm-semantic-status ${current.conforms?'pass':'fail'}`}><ShieldCheck size={22}/><div><strong data-testid="shacl-result">{current.conforms?'CONFORMS · C-MAPSS profile':'NON-CONFORMING · evidence incomplete'}</strong><span>Engine {current.engine} · cycle {current.cycle} · {current.triples} triples · {current.rows.length} query rows · {current.violations.length} validation results</span></div></div>
        {!current.conforms&&<p className="cm-semantic-warning">This RDF snapshot is not ready for evidence use. The query still runs for diagnosis; its rows are not a validation pass.</p>}
        {!!current.violations.length&&<div className="cm-violations">{current.violations.map((v,i)=><div key={i}><strong>{compact(v.path) || compact(v.constraint)}</strong><p>{v.message || compact(v.constraint)}</p><small>{v.focus}</small></div>)}</div>}
        <div className="cm-table-wrap"><table aria-label="SPARQL results"><thead><tr>{columns.map(c=><th key={c}>?{c}</th>)}</tr></thead><tbody>{current.rows.map((row,i)=><tr key={i}>{columns.map(c=><td key={c}>{display(row[c])}</td>)}</tr>)}</tbody></table>{!current.rows.length&&<p className="cm-caption">{queryId==='contract'&&!input.contract?'No named contract is applied. Select one in Service decisions to query its budget.':'No rows: required links or units may be missing for this query.'}</p>}</div>
        <details className="cm-query"><summary>Inspect executed SPARQL</summary><pre>{current.query}</pre></details>
        <div className="cm-semantic-downloads">{(['dataset','report','query','results'] as const).map(kind=><button key={kind} className="cm-button" onClick={()=>download(kind)}><Download size={14}/>{({dataset:'RDF snapshot',report:'SHACL report',query:'SPARQL query',results:'Results + hashes'})[kind]}</button>)}</div>
      </>}
    </div>
    <div className="cm-boundary"><ShieldCheck size={18}/><span><strong>Precisely scoped validation</strong><br/>Checks cover explicit cycle units, ordered RUL bounds, source hashes, observation links, policy and recommendation structure. They do not prove prediction accuracy, cost optimality, real contract compliance or full source-ontology conformance. No OWL inference or SHACL-SPARQL constraints are executed.</span></div>
    <div className="cm-semantic-links"><a href={`${base}cmapss/cmapss-profile.ttl`} download>Cycle extension TTL ↗</a><a href={`${base}cmapss/cmapss-shapes.ttl`} download>Executed SHACL shapes ↗</a></div>
  </section>;
}
