import { runComparison } from './experiments';
self.onmessage = (event) => {
  try { self.postMessage({ result: runComparison(event.data) }); }
  catch (e) { self.postMessage({ error: e instanceof Error ? e.message : String(e) }); }
};
