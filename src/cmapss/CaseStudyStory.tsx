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
const base=(import.meta as unknown as {env:{BASE_URL:string}}).env.BASE_URL;
const points=data.engines.find(e=>e.id===34)!.points;
const provenance={model:data.model,baselineSHA256:data.baselineSHA256,exporterSHA256:data.exporterSHA256,files:data.files,sensorNumbers:data.sensorNumbers,ontologySHA256:schema.sha256};
type Check=Awaited<ReturnType<typeof executeSemantic>>&{stage:string;cycle:number;shapesSHA256:string;datasetSHA256:string};
const modules=[['OE','Asset','资产边界'],['DCE','Observation','数据获取'],['DTE','RUL estimate','状态与预测'],['UE','Contract → Advice','政策与服务决策'],['CS','Provenance / validation','跨环节追踪']];
const f=(n:number)=>n.toFixed(1);
export default function CaseStudyStory({onClose}:{onClose:()=>void}) {
 const [player,dispatch]=useReducer(storyReducer,initialPlayer);
 const [speed,setSpeed]=useState(1);
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
  if(!player.playing||!ready)return;
  const timer=window.setInterval(()=>dispatch({type:'tick',delta:100*speed,ready:true}),100);
  return ()=>window.clearInterval(timer);
 },[player.playing,player.index,ready,speed]);
 useEffect(()=>{
  setError('');
  if(!requirement||result)return;
  let cancelled=false;
  const controller=new AbortController();
  (async()=>{
   try {
    const load=async(path:string)=>{const r=await fetch(`${base}cmapss/${path}`,{signal:controller.signal});if(!r.ok)throw new Error(`无法加载 ${path} (${r.status})`);return r.text();};
    const [{executeSemantic},shapes,query]=await Promise.all([import('./semantic'),load('cmapss-shapes.ttl'),load(`queries/${requirement.query}.rq`)]);
    const point=points.find(p=>p.cycle===requirement.cycle)!;
    const input={dataset:'FD001' as const,engine:34,point,scenario:requirement.contract?contracts[1].policy:defaults,contract:requirement.contract?contracts[1]:undefined,provenance};
    const value=await executeSemantic(input,shapes,query,requirement.defect);
    if(value.conforms!==requirement.expected||(requirement.expected&&value.rows.length===0)||(!requirement.expected&&!value.violations.length))throw new Error('实际验证结果与案例预期不一致，请检查证据。');
    const hash=async(text:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(v=>v.toString(16).padStart(2,'0')).join('');
    const [shapesSHA256,datasetSHA256]=await Promise.all([hash(shapes),hash(value.datasetTTL)]);
    if(!cancelled)setRecords(old=>({...old,[step.id]:{...value,stage:step.id,cycle:requirement.cycle,shapesSHA256,datasetSHA256}}));
   }catch(e){if(!cancelled){setError(e instanceof Error?e.message:String(e));dispatch({type:'pause'});}}
  })();
  return ()=>{cancelled=true;controller.abort();};
 },[step.id,requirement,result,attempt]);
 function restart(){setRecords({});setVisited(['purpose']);dispatch({type:'restart'});}
 function toggle(){if(player.finished)restart();else dispatch({type:'toggle'});}
 function go(index:number){dispatch({type:'goto',index});}
 function exportRun(){
  const value={version:'0.5.0',mode:'automated explanation of recorded FD001 evidence',engine:34,dataset:'FD001',stage:step.id,cycle:p.cycle,playbackEnded:player.finished,allChaptersVisited:visited.length===storySteps.length,visitedChapters:visited,provenance,semanticChecks:Object.values(records),claims:'Implemented evidence-to-advice workflow; no authorisation, physical intervention or measured benefit is asserted.',script:storySteps};
  const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='cmapss-case-study-story.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 const history=points.filter(v=>v.cycle<=p.cycle);
 const x=(cycle:number)=>22+(cycle-30)/151*476;
 const y=(rul:number)=>132-rul/125*110;
 return <div className={`cm-app cm-story ${player.playing?'is-playing':''}`}>
  <main>
   <header className="cs-top"><div><span className="cm-eyebrow">CASE STUDY · AUTOMATED WALKTHROUGH</span><h1 ref={heading} tabIndex={-1}>从退化证据到可解释的服务决策</h1><p>FD001 / Engine 034 · 约 3 分钟 · 中文讲解 / English terminology</p></div><button className="cm-button" onClick={onClose}><X size={16}/>返回探索 / Exit story</button></header>
   <section className="cs-controls" aria-label="Story playback controls">
    <button className="cm-button cs-play" onClick={toggle} aria-label={player.playing?'Pause story':'Play story'}>{player.playing?<Pause size={16}/>:<Play size={16}/>} {player.finished?'重新播放':player.playing?'暂停':'播放'}</button>
    <button className="cm-button" onClick={restart} aria-label="Restart story"><RotateCcw size={16}/>重播</button>
    <button className="cm-button" onClick={()=>go(player.index-1)} disabled={player.index===0} aria-label="Previous scene"><ArrowLeft size={16}/></button>
    <button className="cm-button" onClick={()=>go(player.index+1)} disabled={player.index===storySteps.length-1} aria-label="Next scene"><ArrowRight size={16}/></button>
    <label>速度<select aria-label="Story speed" value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value={.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option></select></label>
    <span className="cs-position" data-testid="story-position">{player.index+1} / {storySteps.length} · {player.finished?'演示结束':!ready?'等待真实语义执行':player.playing?'自动演示中':'已暂停'}</span>
    <button className="cm-button" onClick={exportRun}><Download size={15}/>导出演示记录</button>
   </section>
   <nav className="cs-chapters" aria-label="Story chapters">{storySteps.map((s,i)=><button key={s.id} onClick={()=>go(i)} aria-current={i===player.index?'step':undefined} aria-label={`Scene ${i+1}: ${s.title}`}><b>{String(i+1).padStart(2,'0')}</b><span>{s.title}</span></button>)}</nav>
   <div className="cs-progress" role="progressbar" aria-label="Current scene progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(player.elapsed/step.duration*100)}><i style={{width:`${player.elapsed/step.duration*100}%`}}/></div>
   <section className="cs-stage" aria-label="Current story scene" data-stage={step.id}>
    <div className="cs-narration" key={step.id}><small>{step.tag}</small><h2 data-testid="story-title">{step.title}</h2><p>{step.text}</p><div className="cs-meaning"><small>本阶段的意义 / WHY IT MATTERS</small><p>{step.meaning}</p></div></div>
    <div className="cs-evidence">
     <div className="cs-evidence-head"><span>RECORDED EVIDENCE · FD001 / 034</span><b>Cycle <span data-testid="story-cycle">{p.cycle}</span></b></div>
     {['purpose','observe','predict'].includes(step.id)&&<>
      <svg className="cs-engine" viewBox="0 0 540 110" role="img" aria-label="概念发动机与数据流，不表示实际损伤或物理传感器位置"><path d="M90 20L320 30L440 47L468 57L440 71L320 87L90 97Z" fill="#dce9e4" stroke="#85a6a2"/><ellipse cx="90" cy="58" rx="28" ry="43" fill="#294853"/><g className="cs-fan">{Array.from({length:10},(_,i)=><path key={i} d="M90 58Q75 38 90 22Q107 45 90 58" fill="#b4d0c5" transform={`rotate(${i*36} 90 58)`}/>)}</g>{[170,190,210,230,310,330,350].map(x=><path key={x} d={`M${x} 35v47`} stroke="#6b9996" strokeWidth="8"/>)}<path d="M110 58H465" stroke="#b57b4a" strokeWidth="4"/><text x="10" y="108" fontSize="10" fill="#69857e">CONCEPTUAL ASSET · RECORDED DATA REPLAY</text></svg>
      <div className="cs-metrics"><div><small>RUL point</small><b>{f(p.point)} <em>cycles</em></b></div><div><small>Residual interval</small><b>{f(p.low)}–{f(p.high)}</b></div><div><small>Service state</small><b>{state(p.low)}</b></div></div>
      <svg className="cs-trace" viewBox="0 0 520 158" role="img" aria-label={`已观测前缀的 RUL 预测，当前周期 ${p.cycle}`}><path d="M22 22V132H498" fill="none" stroke="#b8cac3"/><polyline points={history.map(v=>`${x(v.cycle)},${y(v.low)}`).join(' ')} fill="none" stroke="#9abbaf" strokeDasharray="4 4"/><polyline points={history.map(v=>`${x(v.cycle)},${y(v.high)}`).join(' ')} fill="none" stroke="#9abbaf" strokeDasharray="4 4"/><polyline points={history.map(v=>`${x(v.cycle)},${y(v.point)}`).join(' ')} fill="none" stroke="#127b78" strokeWidth="3"/><circle cx={x(p.cycle)} cy={y(p.point)} r="4" fill="#127b78"/><text x="22" y="151">30</text><text x="464" y="151">181 cycles</text><text x="25" y="15">RUL · 0–125 cycles</text></svg>
      <div className="cs-sensors">{data.sensorNumbers.slice(0,3).map((n,i)=><span key={n}>Sensor {n}<b>{p.sensors[i]}</b></span>)}</div><p className="cs-caption">显示原始传感器值与预计算的前缀预测。实线为点估计，虚线为残差区间；没有使用未来测试真值。</p>
     </>}
     {['semantics','quality','handoff'].includes(step.id)&&<>
      <div className="cs-chain"><div><small>sdt:Asset</small><b>Engine 034</b></div><span>← sosa:hasFeatureOfInterest</span><div><small>sosa:Observation</small><b>Cycle {p.cycle} / sensor values</b></div><span>← cm:observation</span><div><small>cm:ObservationWindow</small><b>Cycles {Math.max(1,p.cycle-29)}–{p.cycle}</b></div><span>← prov:wasDerivedFrom</span><div><small>cm:CycleRULEstimate</small><b>{f(p.point)} cycles</b></div><span>← cm:basedOnEstimate</span><div><small>Recommendation · proposed</small><b>{decision.chosen.name}</b></div></div><p className="cs-caption cs-links">Estimate → cm:generatedWith → {data.model}<br/>Window → prov:wasDerivedFrom → test_FD001.txt<br/>Recommendation → prov:wasDerivedFrom → Contract / Policy</p>
      {step.id==='quality'&&<p className="cs-warning">TEST COPY：移除 cm:unit → cm:Cycle；原始数据不变。</p>}
      {step.id==='handoff'&&<div className="cs-boundary"><b>下一步尚未执行</b><p>人工授权 → 维护执行 → 新观测 → 结果评估</p><span>原数据没有维护后的轨迹，不能把这条链动画成已完成的物理闭环。</span></div>}
     </>}
     {['cost','margin'].includes(step.id)&&<><div className="cs-fixed">同一 RUL：{f(p.point)} · 下界 {f(p.low)} cycles</div><div className="cs-contracts">{pair.map(({terms,decision,budget})=><article key={terms.id}><small>{terms.name}</small><dl><dt>后果成本</dt><dd>{terms.policy.consequence}×</dd><dt>介入门槛</dt><dd>{terms.policy.gate} cycles</dd></dl><b data-testid={`story-${terms.id}`}>{decision.chosen.name}</b><p>成本 {decision.chosen.total.toFixed(3)} · {decision.gated?'门槛触发':'成本排序'}</p>{step.id==='margin'&&<p>假设目标 {terms.target*100}%<br/>计划损失预算余量：{budget.plannedMarginSlots.toFixed(0)} slots</p>}</article>)}</div><p className="cs-caption">合同参数为研究假设。目标值与介入门槛独立设定；KPI 预算不参与优化。可用性保障的 −3 slots 表示假设停机超出预算，维护建议不证明满足 99% 目标。</p></>}
     {step.id==='contributions'&&<><div className="cs-contributions">{[
      ['C1 · 服务化架构映射','将观测、预测、政策与建议分配到可解释的职责环节。','证据：运行中的 DT framework 映射。'],
      ['C2 · 可执行的语义证据','周期 RUL 扩展、来源链、SPARQL 与 SHACL 共同支持可查询和可检查的证据。','证据：有效快照通过，缺少单位副本失败。'],
      ['C3 · 合同情境决策','同一技术证据可在不同成本与门槛下产生不同建议。','证据：cycle 158 / 171 的受控比较。']
     ].map(([title,text,evidence])=><article key={title}><b>{title}</b><p>{text}</p><small>{evidence}</small></article>)}</div><div className="cs-scope"><b>验证范围与局限</b><p>四个子集独立训练，32 台发动机、4,835 个回放快照；不是跨域迁移验证。</p><div>{metadata.map(d=><span key={d.dataset}>{d.dataset}<b>{(d.coverage*100).toFixed(1)}%</b>区间覆盖率</span>)}</div><p>覆盖率以全测试集端点计算，标称目标 80% 并未普遍达到。未证明服务收益、实际可用率、完整 ISO 符合性或理论新颖性。</p></div></>}
     {requirement&&<div className="cs-check" aria-live="polite">{error?<><strong role="alert">语义执行未完成：{error}</strong><button className="cm-button" onClick={()=>setAttempt(v=>v+1)}>重试验证</button></>:!result?<strong>正在真实执行 RDF / SHACL / SPARQL…</strong>:<><strong data-testid="story-check">{result.conforms?'SHACL CONFORMS':'SHACL NON-CONFORMING · 预期失败'}</strong><span>{result.triples} triples · {result.rows.length} query rows · {result.violations.length} validation results</span><details><summary>查看实际查询结果与约束报告</summary><pre>{JSON.stringify({rows:result.rows,violations:result.violations},null,2)}</pre></details></>}</div>}
    </div>
   <section className="cs-synergy" aria-label="Framework and ontology collaboration"><div className="cs-synergy-head"><h2>DT framework × Ontology</h2><span>职责分配 + 语义对象 + 证据约束</span></div><div className="cs-lanes">{modules.map(([id,object,label],i)=><div key={id} className={(step.modules as readonly number[]).includes(i)?'active':''}><small>FRAMEWORK · {id}</small><b>{label}</b><span className="cs-bridge">↕ 对象 / 关系 / 来源</span><strong>{object}</strong></div>)}</div><div className="cs-explanation"><p><b>Framework 的作用</b>{step.framework}</p><p><b>Ontology 的作用</b>{step.ontology}</p></div><p className="cs-caption">高亮表示当前讲解涉及的职责；不是网络活动或 OWL 推理轨迹。映射基于本原型的 ISO 23247-inspired 设计，并不声称完整标准符合性。</p></section>
   </section>
   <details className="cs-transcript"><summary>阅读完整讲解稿 / Transcript</summary>{storySteps.map(s=><article key={s.id}><h3>{s.tag} · {s.title}</h3><p>{s.text}</p><p>{s.meaning}</p></article>)}</details>
   <footer className="cs-footer">可复现的观测 → 预测 → 语义证据 → 政策 → 建议；物理服务闭环尚未执行。<span>切到后台将暂停；手动选章节后点击播放继续。</span></footer>
  </main>
 </div>;
}
