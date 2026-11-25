import type { OntologySnapshot } from './model.ts';

export const questionVersion = 'wt-cq-1.0';
export const questions = [
  { id: 'evidence', label: 'Why this service?', example: 'Why was this service recommended?' },
  { id: 'condition', label: 'WT condition', example: 'What is the current crack length and service state?' },
  { id: 'rul', label: 'RUL estimate', example: 'What is the current blade RUL?' },
  { id: 'candidates', label: 'Which services qualify?', example: 'Which candidate services are eligible?' },
  { id: 'cheapest', label: 'Lowest eligible TCS', example: 'Which eligible service has the lowest TCS?' },
  { id: 'rejected', label: 'Risk-filter rejections', example: 'Which services fail the residual-risk filter?' },
  { id: 'costs', label: 'Selected service cost breakdown', example: 'What is the cost breakdown of the selected service?' },
  { id: 'provenance', label: 'Source and model provenance', example: 'Where do the data come from and which model is used?' },
  { id: 'features', label: 'Which features support RUL?', example: 'Which input features support the RUL estimate?' },
  { id: 'uncertainty', label: 'Meaning of the RUL bounds', example: 'What do the RUL uncertainty bounds mean?' },
  { id: 'latest', label: 'Latest retained service / downtime', example: 'What was the latest service and its downtime?' },
  { id: 'outcome', label: 'Latest retained service: before / after', example: 'How did crack and RUL change before and after the latest service?' },
  { id: 'authorisation', label: 'Human authorisation evidence', example: 'Was human approval recorded?' },
  { id: 'validation', label: 'Evidence validation', example: 'Does this evidence pass SHACL validation?' }
] as const;
export type QuestionId = typeof questions[number]['id'];
export type Interpretation = { status: 'matched'; id: QuestionId; label: string } | { status: 'clarify' | 'unsupported'; message: string };
export function isQuestionId(value: unknown): value is QuestionId { return questions.some(question => question.id === value); }

const prefix = 'PREFIX wt: <https://w3id.org/sdt-wt/demo#>\nPREFIX sdt: <http://purl.org/sdt/>\nPREFIX prov: <http://www.w3.org/ns/prov#>\n';
const root = '<urn:wt:active-snapshot>';
const estimate = `${root} wt:estimate ?e . ?e wt:unit wt:PseudoHour ; wt:lowerBound ?lower ; wt:pointEstimate ?point ; wt:upperBound ?upper ; wt:modelVersion ?model ; wt:boundMeaning ?meaning .`;
const candidate = `${root} wt:recommendation ?r . ?r wt:candidate ?c . ?c wt:action ?service ; wt:totalCost ?cost ; wt:riskIndex ?risk ; wt:eligible ?eligible .`;
const latest = `${root} wt:retainedEvent ?event . ?event wt:eventOrder 0 ; wt:eventId ?eventId ; wt:action ?service ; wt:executionStatus ?status ; wt:plannedDowntime ?planned ; wt:downtimeUnit wt:ModeledHour ; wt:beforeCapturedAt ?beforeTime . OPTIONAL { ?event wt:elapsedDowntime ?elapsed }`;
const bodies: Record<QuestionId, string> = {
  evidence: `SELECT ?asset ?service ?cost ?risk ?eligible ?basis ?lower ?point ?upper ?model WHERE {
    ${root} wt:asset ?a ; wt:recommendation ?r . ?a wt:assetName ?asset . ${estimate}
    ?r wt:basedOnEstimate ?e ; wt:selectionBasis ?basis ; wt:selectedCandidate ?c .
    ?c wt:action ?service ; wt:totalCost ?cost ; wt:riskIndex ?risk ; wt:eligible ?eligible . } LIMIT 1`,
  condition: `SELECT ?asset ?component ?state ?crack ?wind ?direction ?rms WHERE {
    ${root} wt:asset ?a ; wt:estimate ?e . ?a wt:assetName ?asset ; wt:componentName ?component ; wt:serviceState ?state .
    OPTIONAL { ?a wt:crackMm ?crack ; wt:crackUnit wt:Millimetre }
    ?e prov:wasDerivedFrom ?w . ?w wt:windSpeed ?wind ; wt:windSpeedUnit wt:MetrePerSecond ; wt:windDirection ?direction ; wt:windDirectionUnit wt:Degree ; wt:vibrationRms ?rms ; wt:vibrationUnit wt:StandardGravity . } LIMIT 1`,
  rul: `SELECT ?lower ?point ?upper ?model ?meaning WHERE { ${estimate} } LIMIT 1`,
  candidates: `SELECT ?service ?cost ?risk ?eligible WHERE { ${candidate} } ORDER BY ?cost LIMIT 30`,
  cheapest: `SELECT ?service ?cost ?risk ?eligible WHERE { ${candidate} FILTER(?eligible = true) } ORDER BY ?cost ?service LIMIT 1`,
  rejected: `SELECT ?service ?cost ?risk ?eligible WHERE { ${candidate} FILTER(?eligible = false) } ORDER BY ?cost LIMIT 30`,
  costs: `SELECT ?service ?total ?item ?cost WHERE {
    ${root} wt:recommendation ?r . ?r wt:selectedCandidate ?c . ?c wt:action ?service ; wt:totalCost ?total ; wt:costItem ?i .
    ?i wt:costLabel ?item ; wt:costValue ?cost ; wt:costUnit wt:GBP . } ORDER BY DESC(?cost) LIMIT 30`,
  provenance: `SELECT ?snapshot ?captured ?readingTime ?observed ?received ?source ?featureSource ?model ?ontologyHash ?modelHash WHERE {
    ${root} wt:snapshotId ?snapshot ; wt:capturedAt ?captured ; wt:readingTime ?readingTime ; wt:sourceOntologySHA256 ?ontologyHash ; wt:estimate ?e .
    ?e wt:modelVersion ?model ; prov:wasDerivedFrom ?w . ?w wt:source ?source ; wt:featureSource ?featureSource .
    OPTIONAL { ${root} wt:observedAt ?observed } OPTIONAL { ${root} wt:receivedAt ?received }
    OPTIONAL { ?e wt:generatedWith ?m . ?m wt:p50SHA256 ?modelHash } } LIMIT 1`,
  features: `SELECT ?name ?value ?source WHERE { ${root} wt:estimate ?e . ?e prov:wasDerivedFrom ?w .
    ?w wt:featureSource ?source ; wt:feature ?f . ?f wt:featureName ?name ; wt:featureValue ?value . } ORDER BY ?name LIMIT 31`,
  uncertainty: `SELECT ?lower ?point ?upper ?model ?meaning WHERE { ${estimate} } LIMIT 1`,
  latest: `SELECT ?eventId ?service ?status ?planned ?elapsed ?beforeTime WHERE { ${latest} } LIMIT 1`,
  outcome: `SELECT ?eventId ?service ?status ?planned ?elapsed ?beforeTime ?afterTime ?beforeCrack ?afterCrack ?beforeP50 ?afterP50 ?beforeModel ?afterModel WHERE {
    ${latest} ?event wt:beforeP50 ?beforeP50 ; wt:beforeModel ?beforeModel .
    OPTIONAL { ?event wt:beforeCrack ?beforeCrack }
    OPTIONAL { ?event wt:afterCapturedAt ?afterTime ; wt:afterP50 ?afterP50 ; wt:afterModel ?afterModel }
    OPTIONAL { ?event wt:afterCrack ?afterCrack } } LIMIT 1`,
  authorisation: `SELECT (COUNT(?approval) AS ?records) WHERE { ?approval a sdt:ActionAuthorisation . }`,
  validation: `SELECT ?snapshot ?captured ?ontologyHash WHERE { ${root} wt:snapshotId ?snapshot ; wt:capturedAt ?captured ; wt:sourceOntologySHA256 ?ontologyHash . } LIMIT 1`
};

// Only trusted SELECT templates enter the engine; no user text is interpolated into SPARQL.
export function questionQuery(id: QuestionId): string {
  if (!isQuestionId(id)) throw new Error('Unsupported competency question');
  return prefix + bodies[id];
}

export function interpretQuestion(input: string, context: Pick<OntologySnapshot, 'asset' | 'component'>): Interpretation {
  const text = input.normalize('NFKC').trim().toLowerCase().replace(/[’]/g, "'");
  const unsupported = (message: string): Interpretation => ({ status: 'unsupported', message });
  const clarify = (message: string): Interpretation => ({ status: 'clarify', message });
  if (!text || text.length > 400) return clarify('Enter one question of 1 to 400 characters.');
  if (/\b(select|construct|describe|insert|delete|drop|load|clear|sparql|service\s*<|https?:\/\/|ignore|override)\b|[{}]|忽略.*规则|执行.*代码/.test(text)) return unsupported('Only natural-language evidence questions are accepted, not code, SPARQL or external requests.');
  if (/what if|would|if we|counterfactual|假如|如果|假设|未来|何时|什么时候|多久.*(失效|故障)|when.*(fail|break)|real.*(rul|life)|真实.*寿命|physical.*(rul|life)/.test(text)) return unsupported('Counterfactuals and physical failure-time predictions require a separate validated model; this question service reads captured evidence only.');
  if (/shap|importance|most influential|most important|贡献|重要性|影响最大|最影响/.test(text)) return unsupported('Feature values are available, but feature-attribution evidence such as SHAP is not supplied.');
  if (/cause|causal|how.*(affect|impact)|will.*(fail|break)|导致|造成|如何.*影响|明天|下周/.test(text)) return unsupported('Causal effects and future outcomes are not established by captured ontology links.');
  if (/why|为什么/.test(text) && /rul|crack|vibration|wind|裂纹|振动|风速|寿命/.test(text) && !/service|maintenance|recommend|服务|维修|维护|推荐/.test(text)) return unsupported('A causal or model-attribution explanation is not supplied by the captured values. Ask for the estimate, inputs or provenance.');
  if (/accuracy|how accurate|confidence|failure probability|准确|可信度|故障概率|失效概率/.test(text)) return unsupported('Field accuracy, calibrated confidence and failure probability are not established by this RDF snapshot.');
  if (/\biso\b|iso\s*23247|\bowl\b|chapter\s*4|full.*ontology|完整.*本体/.test(text)) return unsupported('This query service validates only the WT SHACL application profile; it does not certify ISO implementation conformity, full Chapter 4 conformance or OWL entailment.');
  if (/\d{4}[-/]\d|\d+\s*(mm|m\/s|hours?|毫米|小时)|yesterday|last week|last month|all.time|since|累计|全部历史|昨天|上周|上个月|超过|大于|小于|more than|greater than|less than|at least|[<>]/.test(text)) return unsupported('Date-range, all-time and numeric-filter questions are outside this version. Retained history covers at most 30 events.');
  const assets = [...text.matchAll(/(?:turbine|wt)\s*[-_]?\s*(\d+)/g)].map(match => Number(match[1]));
  const expected = Number(context.asset.match(/\d+/)?.[0]);
  if (assets.some(asset => asset !== expected)) return unsupported(`Only ${context.asset} is in this captured dataset.`);
  const blades = [...text.matchAll(/blade\s*[-_]?\s*([a-z]|\d+)(?=\b)|叶片\s*([a-z])|([a-z])\s*叶片/g)].map(match => match[1] ?? match[2] ?? match[3]);
  const component = context.component.toLowerCase().replace(/^blade[-\s]*/, '');
  if (blades.some(blade => blade !== component)) return unsupported(`Only ${context.component} is in this captured dataset.`);
  if (/why.*(not chosen|not selected)|为什么.*(没选|未选|不选)/.test(text)) return clarify('Not selected does not mean ineligible. Ask for all candidate costs/eligibility or the evidence for the selected recommendation.');
  if (/\b(predictive|preactive|proactive|corrective|active) maintenance\b/.test(text)) return clarify('Named-service filtering is not supported. Ask about the selected service or all candidate services.');
  if (/\bnot\b|不要|并非|不是/.test(text) && !/not eligible|not recorded/.test(text)) return clarify('Negated questions need clarification. Ask one positive evidence question or explicitly request risk-filter rejections.');
  const matches = new Set<QuestionId>();
  const attribution = /feature|特征|模型输入/.test(text);
  const uncertainty = /uncertainty|bounds?|interval|quantile|p10.*p90|p90.*p10|不确定|区间|分位/.test(text);
  const outcome = /before.*after|前后|after.*(repair|maintenance|service)|维修效果|维修.*变化/.test(text);
  const provenance = /provenance|data.*(source|come from)|which model|model version|数据来源|模型版本|模型依据/.test(text);
  const cheapest = /cheapest|lowest.*(cost|tcs)|minimum.*(cost|tcs)|成本最低|最低.*(成本|tcs)|最便宜/.test(text);
  const rejected = /ineligible|not eligible|fail.*risk|reject|未通过|不符合|排除/.test(text);
  if (attribution) matches.add('features');
  if (uncertainty && !attribution) matches.add('uncertainty');
  if (outcome) matches.add('outcome');
  if (provenance) matches.add('provenance');
  if (cheapest) matches.add('cheapest');
  if (rejected) matches.add('rejected');
  if (/qualif|eligible|candidate|哪些服务|候选服务|可选服务|符合.*服务/.test(text) && !cheapest && !rejected) matches.add('candidates');
  if (/cost.*(breakdown|component|item)|费用构成|成本明细|成本构成/.test(text)) matches.add('costs');
  if (/why.*(service|recommend|maintenance)|为什么.*(服务|推荐|维修|维护)/.test(text)) matches.add('evidence');
  if (/authori[sz]|approv|批准|授权/.test(text)) matches.add('authorisation');
  if (/shacl|validat|校验|合规|缺失/.test(text)) matches.add('validation');
  if (/(latest|last|最近|上一次).*(service|maintenance|维修|服务|维护)|downtime|停机/.test(text) && !outcome) matches.add('latest');
  if (/crack|裂纹|service state|operating state|服务状态|运行状态|wind speed|风速|vibration|振动/.test(text) && !outcome && !attribution && !provenance) matches.add('condition');
  if (/\brul\b|remaining useful life|剩余寿命|寿命预测|p50/.test(text) && !attribution && !uncertainty && !outcome && !provenance) matches.add('rul');
  if (!matches.size) return unsupported('No supported evidence question was recognized. Select a competency question to make the intended query explicit.');
  if (matches.size > 1) return clarify('This question combines different evidence requests. Ask one question at a time or select a competency question.');
  const id = [...matches][0];
  return { status: 'matched', id, label: questions.find(question => question.id === id)!.label };
}
