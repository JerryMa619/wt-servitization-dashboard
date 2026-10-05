import { useEffect, useRef, useState } from 'react';
import { Download, Play, RotateCcw } from 'lucide-react';
import Chart from '../components/TelemetryPanel';
import { defaultExperiment, policies, validateExperiment, type Comparison, type ExperimentConfig } from './experiments';

const money = (v: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(v);
const colors = ['#78c4e3', '#e7b557', '#df85ad', '#48c9b0'];
export default function PolicyComparison() {
  const [config, setConfig] = useState({ ...defaultExperiment }), [result, setResult] = useState<Comparison | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const worker = useRef<Worker | null>(null);
  useEffect(() => () => worker.current?.terminate(), []);
  const current = result && JSON.stringify(result.config) === JSON.stringify(config) ? result : null;
  function run() {
    worker.current?.terminate(); setResult(null); setError('');
    try {
      validateExperiment(config); setBusy(true);
      const task = new Worker(new URL('./experiments.worker.ts', import.meta.url), { type: 'module' }); worker.current = task;
      task.onmessage = (event) => { if (worker.current !== task) return; setResult(event.data.result ?? null); setError(event.data.error ?? ''); setBusy(false); task.terminate(); worker.current = null; };
      task.onerror = () => { if (worker.current !== task) return; setError('Comparison worker failed. Retry with the same inputs.'); setBusy(false); task.terminate(); worker.current = null; };
      task.postMessage(config);
    } catch (e) { setBusy(false); setError(e instanceof Error ? e.message : String(e)); }
  }
  function update(name: keyof ExperimentConfig, value: number) { worker.current?.terminate(); worker.current = null; setBusy(false); setError(''); setConfig(c => ({ ...c, [name]: value })); }
  function download() {
    if (!current) return; const url = URL.createObjectURL(new Blob([JSON.stringify(current, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'wt-policy-comparison.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="research-section" aria-label="WT policy comparison" id="policy-comparison">
    <div className="research-heading"><h2>Service Policy Comparison</h2><span>Deterministic simulation / modeled GBP / not measured savings</span></div>
    <div className="research-controls experiment-inputs">
      {([
        ['horizon', 'Horizon / modeled h', 24, 240, 1], ['initialCrack', 'Initial crack / mm', 0, 80, 1], ['windSpeed', 'Mean wind / m/s', 3, 12, .1], ['fixedInterval', 'Fixed interval / modeled h', 12, 120, 1],
        ['consequenceScale', 'Consequence multiplier', .25, 3, .25], ['downtimeScale', 'Downtime price multiplier', .25, 3, .25], ['repairScale', 'Repair efficacy multiplier', .5, 1.5, .25]
      ] as const).map(([name, label, min, max, step]) => <label key={name}>{label}<input aria-label={label} type="number" min={min} max={max} step={step} value={Number.isFinite(config[name]) ? config[name] : ''} onChange={e => update(name, e.target.valueAsNumber)} /></label>)}
      <div className="research-actions"><button disabled={busy} onClick={run}><Play size={15} />{busy ? 'Calculating' : 'Run comparison'}</button><button title="Reset comparison assumptions" aria-label="Reset comparison assumptions" onClick={() => { worker.current?.terminate(); worker.current = null; setBusy(false); setError(''); setConfig({ ...defaultExperiment }); setResult(null); }}><RotateCcw size={16} /></button><button disabled={!current} title="Download policy comparison" aria-label="Download policy comparison" onClick={download}><Download size={16} /></button></div>
    </div>
    {error && <p role="alert" className="research-warning">{error}</p>}
    {!current && <p className="research-scope" role="status">{busy ? 'Evaluating four policies and one-at-a-time sensitivity variants.' : result ? 'Inputs changed; results must be recalculated.' : 'No comparison recorded for these assumptions.'}</p>}
    {current && <>
      <div className="research-table-wrap"><table aria-label="Policy comparison results"><thead><tr><th>Policy</th><th>TCS / GBP</th><th>Incurred cost</th><th>Terminal risk allowance</th><th>Downtime / h</th><th>Services completed / started</th><th>Unsafe operating / h</th><th>Risk-filter violations</th></tr></thead><tbody>{current.results.map(r => <tr key={r.policy}><th>{policies.find(p => p.id === r.policy)!.label}</th><td>{money(r.cost)}</td><td>{money(r.incurredCost)}</td><td>{money(r.terminalRiskAllowance)}</td><td>{r.downtimeH}</td><td>{r.servicesCompleted} / {r.servicesStarted}</td><td>{r.unsafeOperatingH}</td><td>{r.rejectedRepairCount}</td></tr>)}</tbody></table></div>
      <Chart title="Modeled Cumulative Incurred Cost" subtitle="Terminal risk allowance excluded from this time-series; included once in table TCS" option={{ animation: false, tooltip: { trigger: 'axis', confine: true }, legend: { type: 'scroll', textStyle: { color: '#a5bcb5' }, pageTextStyle: { color: '#a5bcb5' }, top: 0 }, grid: { left: 62, right: 24, top: 60, bottom: 52 }, xAxis: { type: 'value', name: 'Modeled h', nameLocation: 'middle', nameGap: 30, nameTextStyle: { color: '#a5bcb5' }, axisLabel: { color: '#a5bcb5' } }, yAxis: { type: 'value', min: 0, name: 'GBP', nameTextStyle: { color: '#a5bcb5' }, axisLabel: { color: '#a5bcb5' }, splitLine: { lineStyle: { color: '#294038' } } }, series: current.results.map((r, i) => ({ name: policies[i].label, type: 'line', smooth: false, showSymbol: false, color: colors[i], data: r.series.map(p => [p.hour, p.incurredCost]) })) }} />
      <details><summary>Cost and efficacy sensitivity</summary><div className="research-table-wrap"><table aria-label="Policy sensitivity results"><thead><tr><th>Assumption</th>{policies.map(p => <th key={p.id}>{p.label} / GBP</th>)}<th>Lowest modeled cost</th></tr></thead><tbody>{current.sensitivity.map(s => <tr key={s.label}><th>{s.label}</th>{s.outcomes.map(o => <td key={o.policy}>{money(o.cost)}<small>{o.unsafeOperatingH} unsafe h / {o.rejectedRepairCount} risk violations</small></td>)}<td>{policies.find(p => p.id === s.minimumCostPolicy)!.label}</td></tr>)}</tbody></table></div></details>
      <details><summary>Accounting, assumptions and incomplete services</summary><p>{current.accounting}</p><p>{current.scope}</p><p>Model {current.modelVersion}. Safety thresholds, repair fractions, risk allowance and service durations are assumptions. Lowest cost is not automatically the safest or best policy.</p>{current.results.map(r => <p key={r.policy}>{policies.find(p => p.id === r.policy)!.label}: final crack {r.finalCrack.toFixed(1)} mm; {r.events.filter(e => !e.completed).length} intervention(s) unfinished at the horizon.</p>)}</details>
    </>}
  </section>;
}
