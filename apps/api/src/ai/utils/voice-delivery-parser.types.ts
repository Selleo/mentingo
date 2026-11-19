/** Grammar states for the SDK's sentence-array JSON envelope. */
export type VoiceDeliveryParserState =
  | "root"
  | "root-key"
  | "root-colon"
  | "array"
  | "first-element"
  | "element"
  | "field"
  | "field-colon"
  | "value"
  | "field-separator"
  | "array-separator"
  | "root-close"
  | "done"
  | "string";

export type VoiceDeliveryStringTarget = "root-key" | "field" | "cue" | "text";
