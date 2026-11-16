import { VoiceDeliveryParser } from "./voice-delivery-parser";

/** Stream decoded sentence prefixes after their cue is known; validate completion.
 * Closing the consumer closes its upstream iterator. A malformed suffix fails the
 * turn after any delivered text, so callers must not persist it as a completed reply.
 */
export async function* streamVoiceSentenceMarkup(
  source: AsyncIterable<string>,
  abortSignal?: AbortSignal,
  validateCompletion?: () => PromiseLike<unknown>,
): AsyncGenerator<string> {
  const parser = new VoiceDeliveryParser();
  for await (const fragment of source) {
    if (abortSignal?.aborted) return;
    const delta = parser.feed(fragment);
    if (delta) yield delta;
  }
  if (abortSignal?.aborted) return;
  parser.finish();
  await validateCompletion?.();
}
