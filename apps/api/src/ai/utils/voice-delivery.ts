import { Value } from "@sinclair/typebox/value";

import { voiceDeliverySentenceSchema } from "src/ai/schemas/voice-delivery.schema";

/** Project complete SDK array elements into existing markup without exposing JSON. */
export async function* streamVoiceSentenceMarkup(
  source: AsyncIterable<unknown>,
  abortSignal?: AbortSignal,
  validateCompletion?: () => PromiseLike<unknown>,
): AsyncGenerator<string> {
  let count = 0;
  for await (const value of source) {
    if (abortSignal?.aborted) return;
    if (!Value.Check(voiceDeliverySentenceSchema, value)) {
      throw new Error("VOICE_DELIVERY_INVALID: invalid sentence object");
    }
    const cue = value.cue.trim();
    const text = value.text.trim();
    count += 1;
    if (
      count > 12 ||
      !cue ||
      cue.length > 128 ||
      /[<>\[\]⟦⟧\r\n]/u.test(cue) ||
      !text ||
      text.length > 2048 ||
      text.includes("⟦cue:") ||
      text.includes("⟦emotion:")
    ) {
      throw new Error("VOICE_DELIVERY_INVALID: invalid sentence bounds or controls");
    }
    yield `⟦cue:${cue}⟧${text} `;
  }
  if (abortSignal?.aborted) return;
  await validateCompletion?.();
  if (count === 0) {
    throw new Error("VOICE_DELIVERY_INVALID: empty sentence stream");
  }
}
