import { useEffect, useRef, useState } from 'react';
import { Download, History, ListChecks, MessageSquareText, Play, Radio, RotateCcw, Search, ShieldCheck, X } from 'lucide-react';
import { evidenceSource, type OntologyExecution, type OntologySnapshot } from './model';
import { interpretQuestion, questions, type Interpretation, type QuestionId } from './semanticQuestions';
import type { QuestionPacket, QuestionResult } from './semanticAnswers';
import type { WtDefect } from './wtSemantic';
import './semanticQuestions.css';

type Entry = { id: number; result: QuestionResult };
export default function WtSemanticWorkbench({ snapshot, executions, context, paused, onLive }: {
  snapshot: OntologySnapshot; executions: OntologyExecution[]; context: QuestionPacket['context']; paused: boolean; onLive: () => void;
}) {
  const [mode, setMode] = useState<'preset' | 'natural'>('preset');
  const [question, setQuestion] = useState<QuestionId>('evidence');
  const [input, setInput] = useState('');
  const [defect, setDefect] = useState<WtDefect>('none');
  const [answers, setAnswers] = useState<Entry[]>([]), [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [interpretation, setInterpretation] = useState<Interpretation | null>(null);
  const request = useRef(0), worker = useRef<Worker | null>(null), controller = useRef<AbortController | null>(null), timer = useRef<number | undefined>(undefined);
  const current = answers.find(answer => answer.id === selected)?.result;
  function stop() { worker.current?.terminate(); worker.current = null; controller.current?.abort(); controller.current = null; window.clearTimeout(timer.current); }
  useEffect(() => () => { request.current++; stop(); }, []);
  function reset() { request.current++; stop(); setBusy(false); setSelected(null); setError(''); setInterpretation(null); }
  function run() {
    reset();
    const resolved: Interpretation = mode === 'preset'
      ? { status: 'matched', id: question, label: questions.find(q => q.id === question)!.label }
      : interpretQuestion(input, snapshot);
    if (mode === 'natural' && context !== 'live' && /\b(now|current|currently)\b|当前|现在/i.test(input)) {
      setInterpretation({ status: 'clarify', message: 'A frozen/historical frame is selected, but the question asks about current readings. Select live evidence or ask about this captured frame explicitly.' }); return;
    }
    setInterpretation(resolved);
    if (resolved.status !== 'matched') return;
    const packet: QuestionPacket = structuredClone({ snapshot, executions, context, requestedAt: new Date().toISOString(),
      input: mode === 'preset' ? questions.find(q => q.id === question)!.example : input.trim(), questionId: resolved.id, defect });
    const id = ++request.current;
    setBusy(true);
    function finish(message: string, result?: QuestionResult) {
      if (request.current !== id) return;
      stop(); setBusy(false); setError(message);
      if (result) { setAnswers(previous => [{ id, result }, ...previous].slice(0, 5)); setSelected(id); }
    }
    controller.current = new AbortController();
    timer.current = window.setTimeout(() => { request.current++; stop(); setBusy(false); setError('Question exceeded 30 seconds and was cancelled. DT state was not changed; retry with the same question.'); }, 30000);
    const signal = controller.current.signal;
    void (async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}ontology/wt-shapes.ttl`, { signal });
        if (!response.ok) throw new Error(`wt-shapes.ttl: HTTP ${response.status}`);
        const shapes = await response.text();
        if (request.current !== id) return;
        const task = new Worker(new URL('./semantic.worker.ts', import.meta.url), { type: 'module' });
        worker.current = task;
        task.onmessage = event => finish(event.data.error ?? '', event.data.result);
        task.onerror = () => finish('Semantic worker failed. No answer was certified; retry the question.');
        task.postMessage({ packet, shapes });
      } catch (e) { if (request.current === id) finish(e instanceof Error ? e.message : String(e)); }
    })();
  }
  function download(kind: 'dataset' | 'report' | 'evidence') {
    if (!current) return;
    const text = kind === 'dataset' ? current.datasetTTL : kind === 'report' ? current.reportTTL : JSON.stringify(current, null, 2);
    const url = URL.createObjectURL(new Blob([text], { type: kind === 'evidence' ? 'application/json' : 'text/turtle' }));
    const a = document.createElement('a'); a.href = url; a.download = `wt-semantic-${kind}-${selected}.${kind === 'evidence' ? 'json' : 'ttl'}`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const keys = current?.rows.length ? [...new Set(current.rows.flatMap(row => Object.keys(row)))] : [];
  const preferred = ['asset', 'component', 'state', 'crack', 'wind', 'direction', 'rms', 'eventId', 'service', 'status', 'lower', 'point', 'upper', 'eligible', 'cost', 'risk', 'item', 'total', 'name', 'value', 'source', 'featureSource', 'model', 'planned', 'elapsed', 'beforeCrack', 'afterCrack', 'beforeP50', 'afterP50'];
  const columns = [...preferred.filter(key => keys.includes(key)), ...keys.filter(key => !preferred.includes(key))];
  const headings: Record<string, string> = { lower: 'Lower / model h', point: 'P50 / model h', upper: 'Upper / model h', cost: 'Assumed GBP', total: 'Total / assumed GBP', risk: 'Risk index', crack: 'Crack / mm', wind: 'Wind / m/s', direction: 'Direction / deg', rms: 'Z RMS / g', planned: 'Planned / modeled h', elapsed: 'Elapsed / modeled h', beforeCrack: 'Before / mm', afterCrack: 'After / mm', beforeP50: 'Before P50 / model h', afterP50: 'After P50 / model h' };
  function display(column: string, value: string | undefined) {
    if (value == null) return 'Not supplied';
    if (column === 'value' && Number.isFinite(Number(value))) return Number(value).toPrecision(6);
    return [...Object.keys(headings), 'records'].includes(column) && Number.isFinite(Number(value)) ? Number(value).toLocaleString('en-GB', { maximumFractionDigits: 3 }) : value;
  }
  return <section className="wt-semantic" aria-label="WT executable semantic validation">
    <div className="research-heading"><h3>WT Semantic Questions</h3><span>WT profile 1.1 / bounded evidence queries</span></div>
    <div className="semantic-evidence-source"><span><Radio size={14} />{paused ? 'DT paused / held' : 'DT running'}</span><span>Input: {context} / {snapshot.asset} / {snapshot.reading.t}</span>{context !== 'live' && <button onClick={onLive}><RotateCcw size={14} />Use live evidence</button>}</div>
    <div className="semantic-mode-tabs" role="tablist" aria-label="Semantic question mode">
      <button role="tab" aria-selected={mode === 'preset'} onClick={() => { reset(); setMode('preset'); }}><ListChecks size={15} />Competency questions</button>
      <button role="tab" aria-selected={mode === 'natural'} onClick={() => { reset(); setMode('natural'); }}><MessageSquareText size={15} />Natural language</button>
    </div>
    <div className="research-controls semantic-query-controls">
      {mode === 'preset' ? <label>Evidence question<select aria-label="WT semantic question" value={question} onChange={e => { reset(); setQuestion(e.target.value as QuestionId); }}>{questions.map(q => <option key={q.id} value={q.id}>{q.label}</option>)}</select></label>
        : <label className="semantic-question-input">Question<textarea aria-label="Natural language question" maxLength={400} rows={3} placeholder="Why was this service recommended?" value={input} onChange={e => { reset(); setInput(e.target.value); }} /></label>}
      <label>Validation case<select aria-label="WT validation case" value={defect} onChange={e => { reset(); setDefect(e.target.value as WtDefect); }}><option value="none">Captured snapshot</option><option value="missing-unit">Test copy: missing model-hour unit</option><option value="missing-evidence">Test copy: missing estimate link</option></select></label>
      <div className="semantic-submit-actions"><button onClick={run} disabled={busy}>{mode === 'preset' ? <Play size={15} /> : <Search size={15} />}<span>{busy ? 'Executing' : mode === 'preset' ? 'Run RDF / SHACL / SPARQL' : 'Ask question'}</span></button>
        <button disabled={!busy} title="Cancel semantic question" aria-label="Cancel semantic question" onClick={() => { reset(); setError('Question cancelled. DT state was not changed.'); }}><X size={16} /></button></div>
    </div>
    <div aria-live="polite">
      {interpretation && <p className={interpretation.status === 'matched' ? 'research-scope' : 'research-warning'} role="status" data-testid="wt-question-interpretation">{interpretation.status === 'matched' ? `Recognized question: ${interpretation.label}` : `${interpretation.status === 'clarify' ? 'Clarification required' : 'Outside supported scope'}: ${interpretation.message}`}</p>}
      {error && <p role="alert" className="research-warning">Semantic execution: {error}</p>}
      {!current && !error && <p className="research-scope">{busy ? 'Executing captured evidence in a separate worker.' : 'No answer recorded for this selection.'}</p>}
      {current && <div className="semantic-answer-evidence" aria-label="Answer and evidence">
        <div className="research-heading"><h3>Answer & Evidence</h3><span>{current.answer.status.replace(/-/g, ' ')} / {current.canonicalQuestion}</span></div>
        <p className={`semantic-answer ${current.answer.status}`} data-testid="wt-semantic-answer">{current.answer.text}</p>
        <dl className="semantic-answer-meta"><div><dt>Question</dt><dd>{current.input}</dd></div><div><dt>Captured context / requested at</dt><dd>{current.context} / {current.requestedAt}</dd></div><div><dt>Snapshot / evidence time</dt><dd>{current.snapshot.id} / {current.snapshot.reading.t}</dd></div><div><dt>Source / feature origin</dt><dd>{evidenceSource(current.snapshot.reading)} / {current.snapshot.reading.rulEvidence?.featureSource ?? 'legacy'}</dd></div></dl>
        {current.defect !== 'none' && <p className="research-warning">Modified test copy only / {current.defect}</p>}
        <div className={`research-status ${current.conforms ? 'pass' : 'fail'}`}><ShieldCheck size={20} /><strong data-testid="wt-shacl-result">{current.conforms ? 'CONFORMS / WT profile' : 'NON-CONFORMING / evidence or eligibility'}</strong><span>{current.triples} triples / {current.rows.length} query rows / {current.violations.length} violations</span></div>
        {current.violations.map((v, i) => <p className="research-warning" key={i}>{v.path.replace('https://w3id.org/sdt-wt/demo#', 'wt:')}: {v.message}</p>)}
        <details open><summary>Matched evidence / {current.rows.length} rows</summary><div className="research-table-wrap"><table aria-label="WT SPARQL results"><thead><tr>{columns.map(column => <th key={column}>{headings[column] ?? column}</th>)}</tr></thead><tbody>{current.rows.map((row, i) => <tr key={i}>{columns.map(column => <td className={['meaning', 'basis'].includes(column) ? 'semantic-wide-cell' : undefined} key={column}>{display(column, row[column])}</td>)}</tr>)}</tbody></table>{!current.rows.length && <p className="research-scope">No matching rows in this captured dataset.</p>}</div></details>
        <details><summary>Executed query, provenance & hashes</summary><pre>{current.query}</pre><p>{current.scope}</p><dl className="semantic-hashes">{(['datasetSHA256', 'snapshotSHA256', 'shapesSHA256', 'querySHA256', 'packetSHA256', 'answerEvidenceSHA256'] as const).map(key => <div key={key}><dt>{key}</dt><dd><code>{current[key]}</code></dd></div>)}</dl></details>
        <ul className="semantic-limitations">{current.answer.limitations.map(limit => <li key={limit}>{limit}</li>)}</ul>
        <div className="research-controls">{(['dataset', 'report', 'evidence'] as const).map(kind => <button key={kind} onClick={() => download(kind)}><Download size={15} />{{ dataset: 'RDF snapshot', report: 'SHACL report', evidence: 'Evidence + hashes' }[kind]}</button>)}</div>
      </div>}
    </div>
    {answers.length > 0 && <div className="semantic-answer-history" aria-label="Recent semantic answers"><h4><History size={14} />Recent answers / {answers.length} of 5</h4>{answers.map(entry => <button key={entry.id} aria-pressed={entry.id === selected} onClick={() => { request.current++; stop(); setBusy(false); setError(''); setInterpretation(null); setSelected(entry.id); }}><span>{entry.result.canonicalQuestion}</span><time>{entry.result.snapshot.reading.t}</time></button>)}</div>}
    <p className="research-scope">Read-only competency-question templates / no language-model API or OWL reasoner. Answers refer to their captured evidence, not subsequent live readings.</p>
    <div className="research-links"><a href={`${import.meta.env.BASE_URL}ontology/wt-profile.ttl`} download>WT profile</a><a href={`${import.meta.env.BASE_URL}ontology/wt-shapes.ttl`} download>Executed shapes</a></div>
  </section>;
}
