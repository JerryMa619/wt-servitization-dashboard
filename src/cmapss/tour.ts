import { state, type Point } from './model.ts';
export function tourStops(points: Point[]) {
  return [
    { state:'Nominal', title:'正常 · Establish the baseline', view:'Twin overview', note:'Observe the available sensor history and the RUL interval. High remaining life supports continued operation under the baseline service policy.' },
    { state:'Watch', title:'关注 · Connect the framework', view:'DT framework', note:'The lower RUL bound first crosses 80 cycles. Trace observation collection into the DTE service-state logic. Watch is a state label; the lowest-cost action can still be Continue.' },
    { state:'Alert', title:'预警 · Inspect semantic evidence', view:'Ontology explorer', note:'The lower bound first crosses 40 cycles. Inspect how the observation window, model and policy support the recommendation. State classification and action selection use different rules.' },
    { state:'Hold', title:'建议维护 · Explain the decision', view:'Service decisions', note:'The lower bound first crosses 15 cycles. The baseline guardrail excludes continued operation, monitoring and inspection; planned maintenance is the lowest-cost eligible advisory. No action is executed.' }
  ].map(stop=>({...stop,index:points.findIndex(p=>state(p.low)===stop.state)})).filter(stop=>stop.index>=0);
}
