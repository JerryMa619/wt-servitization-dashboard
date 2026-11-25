import { executeSemanticQuestion, type QuestionPacket } from './semanticAnswers';

self.onmessage = async (event: MessageEvent<{ packet: QuestionPacket; shapes: string }>) => {
  try { self.postMessage({ result: await executeSemanticQuestion(event.data.packet, event.data.shapes) }); }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : String(error) }); }
};
