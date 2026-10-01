import { ArrowRight, Download } from 'lucide-react';
import { compareContracts, comparisonEvidence, type ContractTerms } from './contracts';
import type { Point } from './model';
const number=(n:number)=>Number(n.toFixed(3)).toString();
export default function ContractComparison({engine,point,activeId,onApply,onExample,onInspect,provenance}:{
  engine:number;point:Point;activeId:string|null;onApply:(c:ContractTerms)=>void;
  onExample:(kind:'cost'|'margin')=>void;onInspect:()=>void;provenance:object;
}) {
  const comparisons=compareContracts(point);
  const [a,b]=comparisons;
  const different=a.decision.chosen.name!==b.decision.chosen.name;
  function download(){
    const value=comparisonEvidence(engine,point,provenance);
    const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download=`cmapss-${engine}-${point.cycle}-contract-comparison.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <section className="cm-panel cm-contract-comparison" aria-label="Contract scenario comparison">
    <div className="cm-panel-head"><div><small>SERVITIZATION · CONTROLLED COMPARISON</small><h2>Same engine. Different service responsibility.</h2></div><button className="cm-button" onClick={download}><Download size={15}/>Export contract comparison</button></div>
    <p className="cm-caption">Engine {engine} · cycle {point.cycle} · RUL {number(point.point)} cycles, bounds {number(point.low)}–{number(point.high)}. Both contracts use this exact observation and prediction.</p>
    <div className="cm-contract-examples"><button className="cm-button" onClick={()=>onExample('cost')}>Show cost-driven example</button><button className="cm-button" onClick={()=>onExample('margin')}>Show earlier-intervention example</button><span>Examples select observed Engine 034 snapshots; they do not alter the trajectory.</span></div>
    <div className="cm-contract-cards">{comparisons.map(({terms:c,budget,decision})=><article key={c.id} className={activeId===c.id?'active':''} aria-label={c.name}>
      <div className="cm-contract-title"><h3>{c.name}</h3><span className="cm-pill">ILLUSTRATIVE CONTRACT</span></div><p>{c.responsibility}</p>
      <dl><dt>Failure consequence ratio</dt><dd>{c.policy.consequence}×</dd><dt>Lower-RUL intervention margin</dt><dd>{c.policy.gate} cycles</dd><dt>Maintenance cost / review multiplier</dt><dd>{c.policy.maintenance} / {c.policy.leadMultiplier}×</dd></dl>
      <div className="cm-contract-action"><small>ADVISORY FOR THIS SNAPSHOT</small><strong data-testid={`contract-action-${c.id}`}>{decision.chosen.name}</strong><span>Expected normalized cost {number(decision.chosen.total)} · {decision.gated?'intervention margin active':'cost-based choice'}</span></div>
      <h4>Contract KPI budget · hypothetical</h4>
      <dl><dt>Cycle-based capacity target</dt><dd>{number(c.target*100)}%</dd><dt>Planning window</dt><dd>{c.periodSlots} scheduled slots</dd><dt>Allowed loss: (1 − target) × window</dt><dd>{number(budget.allowedLossSlots)} slots</dd><dt>Assumed planned / unplanned loss</dt><dd>{c.plannedLossSlots} / {c.unplannedLossSlots} slots</dd><dt>If one planned loss occurs</dt><dd>{number(budget.ifOnePlannedLoss*100)}% capacity proxy</dd><dt>Planned-loss budget margin</dt><dd>{number(budget.plannedMarginSlots)} slots</dd></dl>
      <p className={budget.plannedFits?'cm-budget-fit':'cm-budget-miss'}>{budget.plannedFits?'Assumed planned loss fits this budget.':'Assumed planned loss exceeds this budget. The recommendation does not establish KPI compliance.'}</p>
      <button className="cm-button" aria-pressed={activeId===c.id} onClick={()=>onApply(c)}>{activeId===c.id?'Applied:':'Apply'} {c.name}</button>
    </article>)}</div>
    <div className="cm-contract-conclusion" aria-live="polite"><strong>{different?'The same technical evidence produces different advice.':'Both contracts currently recommend the same action.'}</strong><p>{different?(a.decision.gated!==b.decision.gated?`The lower RUL bound lies between the two intervention margins (${a.terms.policy.gate} and ${b.terms.policy.gate} cycles). The stricter service policy removes operational alternatives.`:'Neither intervention margin is active. Different assumed failure-consequence costs change the ranking of eligible actions.'):'Agreement is a valid result. Use the example buttons to inspect a real snapshot where costs or the intervention margin change the recommendation.'}</p></div>
    {activeId&&<button className="cm-text-button" onClick={onInspect}>Query and validate the applied contract <ArrowRight size={16}/></button>}
    <details className="cm-query"><summary>Inspect both candidate rankings</summary><div className="cm-table-wrap"><table aria-label="Contract candidate rankings"><thead><tr><th>Action</th>{comparisons.map(({terms})=><th key={terms.id}>{terms.name}<br/>cost / eligibility</th>)}</tr></thead><tbody>{a.decision.candidates.map((candidate,i)=><tr key={candidate.name}><th>{candidate.name}</th>{comparisons.map(({terms,decision})=><td key={terms.id}>{number(decision.candidates[i].total)} / {decision.candidates[i].allowed?'eligible':'excluded'}</td>)}</tr>)}</tbody></table></div></details>
    <p className="cm-caption">All contract numbers are declared demonstration assumptions. Scheduled cycle opportunities are an assumed planning denominator, not elapsed hours supplied by C-MAPSS. Budget projections do not measure availability, simulate repair effectiveness or feed the cost optimizer. The target and intervention margin are independently chosen; neither is derived from the other.</p>
  </section>;
}
