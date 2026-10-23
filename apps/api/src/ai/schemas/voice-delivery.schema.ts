import { Type, type Static } from "@sinclair/typebox";

/** One complete spoken sentence and its hidden, model-selected delivery. */
export const voiceDeliverySentenceSchema = Type.Object(
  {
    cue: Type.String({
      description:
        "Short English delivery cue. For providers using the allowed emotion vocabulary, choose exactly one of those values.",
    }),
    text: Type.String({
      description:
        "Exactly one complete spoken sentence. Preserve say/spell controls; omit cue/emotion markers.",
    }),
  },
  { additionalProperties: false },
);

export type VoiceDeliverySentence = Static<typeof voiceDeliverySentenceSchema>;
