import { executeSemanticQuestion, type QuestionPacket } from './semanticAnswers';

// A transitive Promise shim expects Node's global in Vite development workers.
(globalThis as typeof globalThis & { global?: typeof globalThis }).global ??= globalThis;

self.onmessage = async (event: MessageEvent<{ packet: QuestionPacket; shapes: string }>) => {
  try { self.postMessage({ result: await executeSemanticQuestion(event.data.packet, event.data.shapes) }); }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : String(error) }); }
};
