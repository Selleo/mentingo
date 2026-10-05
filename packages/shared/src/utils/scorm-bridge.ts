export const SCORM_TOKEN_PATTERN = /^[a-f0-9]{64}$/u;
export const SCORM_SESSION_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
export type ScormBridgeState = { channel: string; session: string; sequence: number };
export type ScormCall = {
  method: "LMSInitialize" | "LMSSetValue" | "LMSCommit" | "LMSFinish";
  params: string[];
};

export function validateScormCall(value: unknown, state: ScormBridgeState): ScormCall | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const msg = value as Record<string, unknown>;
  if (
    msg.type !== "mentingo:scorm:call" ||
    msg.channel !== state.channel ||
    msg.session !== state.session ||
    msg.sequence !== state.sequence + 1
  )
    return null;
  state.sequence += 1; // #172: a trusted envelope consumes its sequence even if its call is invalid.
  if (!Array.isArray(msg.params)) return null;
  if (msg.method === "LMSSetValue") {
    if (
      msg.params.length !== 2 ||
      typeof msg.params[0] !== "string" ||
      typeof msg.params[1] !== "string" ||
      msg.params[0].length > 255 ||
      msg.params[1].length > 4096
    )
      return null;
    return { method: msg.method, params: msg.params };
  }
  if (msg.method === "LMSInitialize" || msg.method === "LMSCommit" || msg.method === "LMSFinish") {
    if (msg.params.length !== 1 || msg.params[0] !== "") return null;
    return { method: msg.method, params: msg.params };
  }
  return null;
}
