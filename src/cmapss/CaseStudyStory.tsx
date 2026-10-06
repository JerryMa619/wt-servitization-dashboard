import {useEffect,useReducer,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Download,Pause,Play,RotateCcw,X} from 'lucide-react';
import data from './replay.json';
import metadata from './datasets.json';
import schema from '../data/ontologySchema.json';
import {defaults,decide,state} from './model';
import {compareContracts,contracts} from './contracts';
import {initialPlayer,semanticStages,storyPoint,storyReducer,storySteps} from './story';
import type {executeSemantic} from './semantic';
import './story.css';
import {CaseComparison,Contributions,ExaminerPanel,Handoff,SensitivityPanel,ServiceScope} from './VivaPanels';
import {caseRoles,contributionEvidence} from './viva';
const base=(import.meta as unknown as {env:{BASE_URL:string}}).env.BASE_URL;
const points=data.engines.find(e=>e.id===34)!.points;
const provenance={model:data.model,baselineSHA256:data.baselineSHA256,exporterSHA256:data.exporterSHA256,files:data.files,sensorNumbers:data.sensorNumbers,ontologySHA256:schema.sha256};
type Check=Awaited<ReturnType<typeof executeSemantic>>&{stage:string;cycle:number;shapesSHA256:string;datasetSHA256:string};
const modules=[['OE','Asset','Asset boundary'],['DCE','Observation','Data acquisition'],['DTE','RUL estimate','State and prognosis'],['UE','Contract → Advice','Policy and advice'],['CS','Provenance / validation','Evidence tracing']];
const f=(n:number)=>n.toFixed(1);
export default function CaseStudyStory({onClose}:{onClose:()=>void}) {
 const [player,dispatch]=useReducer(storyReducer,initialPlayer);
 const [speed,setSpeed]=useState(1);
 const [manual,setManual]=useState(false);
 const [visited,setVisited]=useState<string[]>([]);
 const [records,setRecords]=useState<Record<string,Check>>({});
 const [error,setError]=useState('');
 const [attempt,setAttempt]=useState(0);
 const heading=useRef<HTMLHeadingElement>(null);
 const step=storySteps[player.index];
 const requirement=semanticStages[step.id];
 const result=records[step.id];
 const ready=!requirement||!!result;
 const p=storyPoint(points,player.index,player.elapsed);
 const pair=compareContracts(p);
 const decision=decide(p,step.id==='margin'?contracts[1].policy:defaults);
 useEffect(()=>{heading.current?.focus();},[]);
 useEffect(()=>{setVisited(old=>old.includes(step.id)?old:[...old,step.id]);},[step.id]);
 useEffect(()=>{const close=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};window.addEventListener('keydown',close);return ()=>window.removeEventListener('keydown',close);},[onClose]);
 useEffect(()=>{
  const hide=()=>{if(document.hidden)dispatch({type:'pause'});};
  document.addEventListener('visibilitychange',hide);
  return ()=>document.removeEventListener('visibilitychange',hide);
 },[]);
 useEffect(()=>{
  if(manual||!player.playing||!ready)return;
  const timer=window.setInterval(()=>dispatch({type:'tick',delta:100*speed,ready:true}),100);
  return ()=>window.clearInterval(timer);
 },[manual,player.playing,player.index,ready,speed]);
 useEffect(()=>{
  setError('');
  if(!requirement||result)return;
  let cancelled=false;
  const controller=new AbortController();
  (async()=>{
   try {
    const load=async(path:string)=>{const r=await fetch(`${base}cmapss/${path}`,{signal:controller.signal});if(!r.ok)throw new Error(`Unable to load ${path} (${r.status})`);return r.text();};
    const [{executeSemantic},shapes,query]=await Promise.all([import('./semantic'),load('cmapss-shapes.ttl'),load(`queries/${requirement.query}.rq`)]);
    const point=points.find(p=>p.cycle===requirement.cycle)!;
    const input={dataset:'FD001' as const,engine:34,point,scenario:requirement.contract?contracts[1].policy:defaults,contract:requirement.contract?contracts[1]:undefined,provenance};
    const value=await executeSemantic(input,shapes,query,requirement.defect);
    if(value.conforms!==requirement.expected||(requirement.expected&&value.rows.length===0)||(!requirement.expected&&!value.violations.length))throw new Error('The actual validation result differs from the expected case outcome. Inspect the evidence.');
    const hash=async(text:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(v=>v.toString(16).padStart(2,'0')).join('');
    const [shapesSHA256,datasetSHA256]=await Promise.all([hash(shapes),hash(value.datasetTTL)]);
    if(!cancelled)setRecords(old=>({...old,[step.id]:{...value,stage:step.id,cycle:requirement.cycle,shapesSHA256,datasetSHA256}}));
   }catch(e){if(!cancelled){setError(e instanceof Error?e.message:String(e));dispatch({type:'pause'});}}
  })();
  return ()=>{cancelled=true;controller.abort();};
 },[step.id,requirement,result,attempt]);
 function restart(){setRecords({});setVisited(['purpose']);dispatch({type:'restart'});if(manual)dispatch({type:'pause'});}
 function toggle(){if(player.finished)restart();else dispatch({type:'toggle'});}
 function go(index:number){dispatch({type:'goto',index});}
 function exportRun(){
  const value={version:'0.6.0',caseRoles,contributionEvidence,mode:'automated explanation of recorded FD001 evidence',engine:34,dataset:'FD001',stage:step.id,cycle:p.cycle,playbackEnded:player.finished,allChaptersVisited:visited.length===storySteps.length,visitedChapters:visited,provenance,semanticChecks:Object.values(records),claims:'Implemented evidence-to-advice workflow; no authorisation, physical intervention or measured benefit is asserted.',script:storySteps};
  const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='cmapss-case-study-story.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 const history=points.filter(v=>v.cycle<=p.cycle);
 const x=(cycle:number)=>22+(cycle-30)/151*476;
 const y=(rul:number)=>132-rul/125*110;
 return <div lang="en" className={`cm-app cm-story ${player.playing?'is-playing':''}`}>
  <main>
   <header className="cs-top"><div><span className="cm-eyebrow">CASE STUDY · AUTOMATED WALKTHROUGH</span><h1 ref={heading} tabIndex={-1}>From degradation evidence to explainable service decisions</h1><p>FD001 / Engine 034 · About 3 minutes · English walkthrough · Evidence-to-advice prototype</p></div><button className="cm-button" onClick={onClose}><X size={16}/>Exit story</button></header>
   <section className="cs-controls" aria-label="Story playback controls">
    <label>Mode<select aria-label="Presentation mode" value={manual?'viva':'overview'} onChange={e=>{setManual(e.target.value==='viva');dispatch({type:'pause'});}}><option value="overview">Automatic overview</option><option value="viva">Viva · manual inspection</option></select></label>
    <button disabled={manual} className="cm-button cs-play" onClick={toggle} aria-label={player.playing?'Pause story':'Play story'}>{player.playing?<Pause size={16}/>:<Play size={16}/>} {player.finished?'Play again':player.playing?'Pause':'Play'}</button>
    <button className="cm-button" onClick={restart} aria-label="Restart story"><RotateCcw size={16}/>Restart</button>
    <button className="cm-button" onClick={()=>go(player.index-1)} disabled={player.index===0} aria-label="Previous scene"><ArrowLeft size={16}/></button>
    <button className="cm-button" onClick={()=>go(player.index+1)} disabled={player.index===storySteps.length-1} aria-label="Next scene"><ArrowRight size={16}/></button>
    <label>Speed<select disabled={manual} aria-label="Story speed" value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value={.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option></select></label>
    <span className="cs-position" data-testid="story-position">{player.index+1} / {storySteps.length} · {player.finished?'Story complete':!ready?'Waiting for semantic execution':manual?'Viva · manual':player.playing?'Autoplay':'Paused'}</span>
    <button className="cm-button" onClick={exportRun}><Download size={15}/>Export story evidence</button>
   </section>
   <nav className="cs-chapters" aria-label="Story chapters">{storySteps.map((s,i)=><button key={s.id} onClick={()=>go(i)} aria-current={i===player.index?'step':undefined} aria-label={`Scene ${i+1}: ${s.title}`}><b>{String(i+1).padStart(2,'0')}</b><span>{s.title}</span></button>)}</nav>
   <div className="cs-progress" role="progressbar" aria-label="Current scene progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(player.elapsed/step.duration*100)}><i style={{width:`${player.elapsed/step.duration*100}%`}}/></div>
   <section className="cs-stage" aria-label="Current story scene" data-stage={step.id}>
    <div className="cs-narration" key={step.id}><small>{step.tag}</small><h2 data-testid="story-title">{step.title}</h2><p>{step.text}</p><div className="cs-meaning"><small>WHY IT MATTERS</small><p>{step.meaning}</p></div><ExaminerPanel stage={step.id}/></div>
    <div className="cs-evidence">
     <div className="cs-evidence-head"><span>RECORDED EVIDENCE · FD001 / 034</span><b>Cycle <span data-testid="story-cycle">{p.cycle}</span></b></div>
     {step.id==='purpose'&&<ServiceScope/>}
     {step.id==='semantics'&&<Handoff elapsed={player.elapsed} manual={manual}/>}
     {['purpose','observe','predict'].includes(step.id)&&<>
      <svg className="cs-engine" viewBox="0 0 540 110" role="img" aria-label="Conceptual engine and data flow; no measured damage or physical sensor locations are depicted"><path d="M90 20L320 30L440 47L468 57L440 71L320 87L90 97Z" fill="#dce9e4" stroke="#85a6a2"/><ellipse cx="90" cy="58" rx="28" ry="43" fill="#294853"/><g className="cs-fan">{Array.from({length:10},(_,i)=><path key={i} d="M90 58Q75 38 90 22Q107 45 90 58" fill="#b4d0c5" transform={`rotate(${i*36} 90 58)`}/>)}</g>{[170,190,210,230,310,330,350].map(x=><path key={x} d={`M${x} 35v47`} stroke="#6b9996" strokeWidth="8"/>)}<path d="M110 58H465" stroke="#b57b4a" strokeWidth="4"/><text x="10" y="108" fontSize="10" fill="#69857e">CONCEPTUAL ASSET · RECORDED DATA REPLAY</text></svg>
      {step.id!=='purpose'&&<><div className="cs-metrics"><div><small>RUL point</small><b>{f(p.point)} <em>cycles</em></b></div><div><small>Residual interval</small><b>{f(p.low)}–{f(p.high)}</b></div><div><small>Service state</small><b>{state(p.low)}</b></div></div>
      <svg className="cs-trace" viewBox="0 0 520 158" role="img" aria-label={`RUL predictions from the observed prefix; current cycle ${p.cycle}`}><path d="M22 22V132H498" fill="none" stroke="#b8cac3"/><polyline points={history.map(v=>`${x(v.cycle)},${y(v.low)}`).join(' ')} fill="none" stroke="#9abbaf" strokeDasharray="4 4"/><polyline points={history.map(v=>`${x(v.cycle)},${y(v.high)}`).join(' ')} fill="none" stroke="#9abbaf" strokeDasharray="4 4"/><polyline points={history.map(v=>`${x(v.cycle)},${y(v.point)}`).join(' ')} fill="none" stroke="#127b78" strokeWidth="3"/><circle cx={x(p.cycle)} cy={y(p.point)} r="4" fill="#127b78"/><text x="22" y="151">30</text><text x="464" y="151">181 cycles</text><text x="25" y="15">RUL · 0–125 cycles</text></svg>
      <div className="cs-sensors">{data.sensorNumbers.slice(0,3).map((n,i)=><span key={n}>Sensor {n}<b>{p.sensors[i]}</b></span>)}</div><p className="cs-caption">Original sensor values and precomputed prefix predictions. Solid line: point estimate. Dashed lines: residual bounds. Future test truth is not used.</p></>}
     </>}
     {['quality','handoff'].includes(step.id)&&<>
      <div className="cs-chain"><div><small>sdt:Asset</small><b>Engine 034</b></div><span>← sosa:hasFeatureOfInterest</span><div><small>sosa:Observation</small><b>Cycle {p.cycle} / sensor values</b></div><span>← cm:observation</span><div><small>cm:ObservationWindow</small><b>Cycles {Math.max(1,p.cycle-29)}–{p.cycle}</b></div><span>← prov:wasDerivedFrom</span><div><small>cm:CycleRULEstimate</small><b>{f(p.point)} cycles</b></div><span>← cm:basedOnEstimate</span><div><small>Recommendation · proposed</small><b>{decision.chosen.name}</b></div></div><p className="cs-caption cs-links">Estimate → cm:generatedWith → {data.model}<br/>Window → prov:wasDerivedFrom → test_FD001.txt<br/>Recommendation → prov:wasDerivedFrom → Contract / Policy</p>
      {step.id==='quality'&&<p className="cs-warning">TEST COPY: remove cm:unit → cm:Cycle. Original data is unchanged. A conventional required-field check could also catch this defect; this is not evidence of ontology superiority.</p>}
      {step.id==='handoff'&&<div className="cs-boundary"><b>Steps not yet executed</b><p>Human authorization → Maintenance → New observations → Outcome evaluation</p><span>The source data has no post-maintenance trajectories. This physical feedback loop has not been completed.</span></div>}
     </>}
     {['cost','margin'].includes(step.id)&&<><div className="cs-fixed">Same RUL: {f(p.point)} · lower bound {f(p.low)} cycles</div><div className="cs-contracts">{pair.map(({terms,decision,budget})=><article key={terms.id}><small>{terms.name}</small><dl><dt>Consequence cost</dt><dd>{terms.policy.consequence}×</dd><dt>Intervention margin</dt><dd>{terms.policy.gate} cycles</dd></dl><b data-testid={`story-${terms.id}`}>{decision.chosen.name}</b><p>Normalized cost {decision.chosen.total.toFixed(3)} · {decision.gated?'margin active':'cost ranking'}</p>{step.id==='margin'&&<p>Assumed target {terms.target*100}%<br/>Planned-loss budget margin: {budget.plannedMarginSlots.toFixed(0)} slots</p>}</article>)}</div><p className="cs-caption">Contract terms are research assumptions. Targets and intervention margins are independent; the KPI budget does not enter the optimizer. A margin of −3 slots under availability assurance means the assumed loss exceeds the budget. Maintenance advice does not establish compliance with the 99% target.</p></>}
     {step.id==='contributions'&&<><Contributions/><div className="cs-scope"><b>Scope and limitations</b><p>Separate models for four subsets; 32 replay engines and 4,835 snapshots. This is not a transfer-learning evaluation.</p><div>{metadata.map(d=><span key={d.dataset}>{d.dataset}<b>{(d.coverage*100).toFixed(1)}%</b>interval coverage</span>)}</div><p>Coverage uses all test endpoints; the nominal 80% level is not consistently achieved. Service benefits, actual availability, full ISO conformance and theoretical novelty are not established.</p></div></>}
     {['predict','cost','margin','contributions'].includes(step.id)&&<SensitivityPanel/>}
     {requirement&&<div className="cs-check" aria-live="polite">{error?<><strong role="alert">Semantic execution incomplete: {error}</strong><button className="cm-button" onClick={()=>setAttempt(v=>v+1)}>Retry validation</button></>:!result?<strong>Executing RDF / SHACL / SPARQL…</strong>:<><strong data-testid="story-check">{result.conforms?'SHACL CONFORMS':'SHACL NON-CONFORMING · expected failure'}</strong><span>{result.triples} triples · {result.rows.length} query rows · {result.violations.length} validation results</span><details><summary>Inspect query results and constraint report</summary><pre>{JSON.stringify({rows:result.rows,violations:result.violations},null,2)}</pre></details></>}</div>}
    </div>
   <section className="cs-synergy" aria-label="Framework and ontology collaboration"><div className="cs-synergy-head"><h2>DT framework × Ontology</h2><span>Responsibilities + semantics + evidence constraints</span></div><div className="cs-lanes">{modules.map(([id,object,label],i)=><div key={id} className={(step.modules as readonly number[]).includes(i)?'active':''}><small>FRAMEWORK · {id}</small><b>{label}</b><span className="cs-bridge">↕ objects / relations / provenance</span><strong>{object}</strong></div>)}</div><div className="cs-explanation"><p><b>Framework role</b>{step.framework}</p><p><b>Ontology role</b>{step.ontology}</p></div><p className="cs-caption">Highlights identify the responsibilities discussed, not network activity or OWL inference. This prototype uses an ISO 23247-inspired mapping without claiming full conformance.</p></section>
   </section>
   <CaseComparison/>
   <details className="cs-research"><summary>Architecture mapping: adopted responsibilities and research extensions</summary><p>ISO 23247-inspired responsibility groups are adapted to a replay-based service-advisory prototype. This is an architectural mapping, not a clause-by-clause conformity assessment.</p><ul><li>OE: engine identity; no connected physical engine.</li><li>DCE: recorded data adapter; live acquisition is absent.</li><li>DTE: prefix feature/model artifacts and cycle-valued estimates.</li><li>UE: TypeScript service policy and proposed advice; contract costs and margins are research assumptions.</li><li>CS: browser RDF materialisation, SPARQL queries, SHACL validation and provenance exports.</li></ul><p>Research extensions: explicit service responsibility, contract-policy provenance and cycle-valued evidence. OWL inference, approval enforcement and physical control are not executed.</p></details>
   <details className="cs-transcript"><summary>Read the full transcript</summary>{storySteps.map(s=><article key={s.id}><h3>{s.tag} · {s.title}</h3><p>{s.text}</p><p>{s.meaning}</p></article>)}</details>
   <footer className="cs-footer">Reproducible observation → prediction → semantic evidence → policy → advice. The physical service loop has not been executed.<span>Playback pauses in the background. After selecting a chapter, press Play to continue.</span></footer>
  </main>
 </div>;
}
