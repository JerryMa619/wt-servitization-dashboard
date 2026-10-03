import type { Point } from './model.ts';
export const storySteps = [
 {id:'purpose',title:'为什么预测寿命还不够？',tag:'01 · RESEARCH QUESTION',start:30,end:30,duration:16000,modules:[0,3],
  text:'同一台发动机、同一份退化证据，面对不同服务责任，可能需要不同的行动。这个案例展示如何把资产预测转化为有依据、可追溯的服务建议。',
  framework:'界定资产、服务参与者与责任边界。',ontology:'把 Asset 与 Contract 关联，使服务情境进入证据结构。',meaning:'研究问题：如何将技术状态与服务责任放在同一条可检查的决策链上？'},
 {id:'observe',title:'让真实观测进入数字孪生',tag:'02 · OBSERVE',start:30,end:94,duration:18000,modules:[0,1],
  text:'沿原始测试轨迹回放运行设置与传感器值。屏幕只显示当前周期及之前的记录；时间被压缩用于讲解，不代表真实设备在线运行。',
  framework:'OE 提供资产身份，DCE 在本案例中由回放适配器承担数据获取职责。',ontology:'SOSA Observation 关联到具体资产，PROV 记录来源文件与周期窗口。',meaning:'把数值放回其资产、周期和来源情境，避免出现无法追溯的孤立读数。'},
 {id:'predict',title:'从观测窗口到寿命与服务状态',tag:'03 · ESTIMATE',start:94,end:158,duration:18000,modules:[2],
  text:'DTE 使用最多 30 个已有周期的窗口特征生成 RUL 估计及残差区间。区间下界映射到服务状态；状态标签和行动选择是两套不同的规则。',
  framework:'DTE 承担状态估计与预测，并把输出交给服务决策功能。',ontology:'cm:CycleRULEstimate 记录周期单位、上下界、生成模型及来源窗口。',meaning:'明确预测的不确定性和单位，使后续决策能够检查它使用的到底是什么证据。'},
 {id:'semantics',title:'让架构中的传递成为语义证据链',tag:'04 · CONNECT & QUERY',start:158,end:158,duration:21000,modules:[1,2,4],
  text:'此刻在浏览器中生成 RDF，执行 SHACL Core 与 SPARQL。查询回答“这项建议来自哪一台发动机、哪个周期、什么预测与政策”，而不是只绘制一张关系图。',
  framework:'Cross-System 职责支撑跨环节的证据追踪。',ontology:'通过类型、属性与来源关系，将 Observation → Estimate → Recommendation 连成可查询结构。',meaning:'架构说明计算发生在哪里；ontology 说明被传递对象的含义，以及证据如何相互关联。'},
 {id:'quality',title:'缺少单位时，证据为什么不能通过？',tag:'05 · CHECK A BROKEN COPY',start:158,end:158,duration:18000,modules:[4],
  text:'只在测试副本中移除 RUL 的周期单位，再执行同一套 SHACL。原始观测和预测保持不变。失败意味着证据结构不完整，不意味着发动机突然发生故障。',
  framework:'在证据交付环节显示验证结果，让使用者识别不完整的证据。',ontology:'约束要求显式周期单位；本演示不会将 cycles 偷换成源 ontology 中的 hours。',meaning:'展示语义约束如何揭示交接问题。SHACL 通过也不等于模型准确、行动安全或合同履约。'},
 {id:'cost',title:'相同技术证据，不同责任成本',tag:'06 · COMPARE CONTRACTS',start:158,end:158,duration:20000,modules:[3],
  text:'固定在 cycle 158，只比较两份声明为假设的合同。维护支持与可用性保障承担不同中断后果成本，因此得到不同建议；这里两个介入门槛都尚未触发。',
  framework:'UE 中的决策功能在既定证据下比较服务政策。',ontology:'Contract 与政策参数进入 Recommendation 的来源链，解释建议为什么随服务情境改变。',meaning:'技术预测保持不变，服务责任改变行动排序：这是案例中服务化作用的一个可复现例子。'},
 {id:'margin',title:'更严格的服务政策，提前介入',tag:'07 · APPLY POLICY',start:171,end:171,duration:21000,modules:[2,3,4],
  text:'来到 cycle 171。RUL 下界位于 15 与 25 cycles 之间。可用性保障合同的更高门槛排除继续运行、监测和检查，并建议计划维护。这里同时真实查询已应用合同。',
  framework:'预测输出进入政策约束，产生供人审阅的建议。',ontology:'合同声明和实际政策参数需要一致；RDF 将建议同时绑定到预测和合同。',meaning:'把提前介入的依据公开，而不是只显示一个“维护”按钮。99% 的假设目标并不证明可履约。'},
 {id:'handoff',title:'交付可检查的建议，明确未闭合环节',tag:'08 · EVIDENCE HANDOFF',start:181,end:181,duration:19000,modules:[3,4],
  text:'到 cycle 181，按基准政策也会触发维护建议。本演示可交付模型、源文件哈希、政策、候选行动及 RDF 验证结果；接下来仍需要人的授权、维护执行与结果观测。',
  framework:'将当前实现的证据链与尚未实现的物理服务闭环分开。',ontology:'Recommendation 状态为 proposed；没有伪造授权、执行或维护后观测。',meaning:'实际意义是支持可审阅的维护规划和责任解释。本数据集不能证明停机减少、成本节省或实际可用率提升。'},
 {id:'contributions',title:'这个 case study 展示了哪些贡献？',tag:'09 · CONTRIBUTIONS & LIMITS',start:181,end:181,duration:23000,modules:[0,1,2,3,4],
  text:'案例支持三个实现层面的贡献：服务化职责的可执行映射、带单位与来源的语义证据结构、固定技术证据下的合同情境决策。它们共同形成从观测到建议的可复现链条。',
  framework:'提供职责分解和功能衔接。',ontology:'提供对象语义、来源关系和可执行的结构约束。',meaning:'两者协同：职责有承载环节，跨环节数据有明确含义，建议有可查询的依据。理论新颖性仍需论文与既有研究比较支持。'}
] as const;
export type PlayerState = {index:number;elapsed:number;playing:boolean;finished:boolean};
export type PlayerAction = {type:'tick';delta:number;ready:boolean}|{type:'goto';index:number}|{type:'toggle'}|{type:'restart'}|{type:'pause'};
export const initialPlayer:PlayerState={index:0,elapsed:0,playing:true,finished:false};
export function storyReducer(s:PlayerState,a:PlayerAction):PlayerState {
 if(a.type==='pause')return {...s,playing:false};
 if(a.type==='restart')return {...initialPlayer};
 if(a.type==='goto')return {index:Math.max(0,Math.min(storySteps.length-1,a.index)),elapsed:0,playing:false,finished:false};
 if(a.type==='toggle')return s.finished?{...initialPlayer}:{...s,playing:!s.playing};
 if(!s.playing||!a.ready)return s;
 const elapsed=s.elapsed+Math.max(0,a.delta);
 if(elapsed<storySteps[s.index].duration)return {...s,elapsed};
 if(s.index===storySteps.length-1)return {...s,elapsed:storySteps[s.index].duration,playing:false,finished:true};
 return {index:s.index+1,elapsed:0,playing:true,finished:false};
}
export function storyPoint(points:Point[],index:number,elapsed:number) {
 const step=storySteps[index];
 const cycle=Math.round(step.start+(step.end-step.start)*Math.min(1,elapsed/(step.duration*.65)));
 const p=points.find(p=>p.cycle===cycle);
 if(!p)throw new Error(`Missing observed cycle ${cycle}`);
 return p;
}
export const semanticStages:Record<string,{cycle:number;defect:'none'|'missing-unit';contract:boolean;query:string;expected:boolean}>={
 semantics:{cycle:158,defect:'none',contract:false,query:'evidence',expected:true},
 quality:{cycle:158,defect:'missing-unit',contract:false,query:'evidence',expected:false},
 margin:{cycle:171,defect:'none',contract:true,query:'contract',expected:true},
 handoff:{cycle:181,defect:'none',contract:false,query:'evidence',expected:true}
};
