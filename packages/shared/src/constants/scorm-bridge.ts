import { SCORM_12_API_METHODS } from "./scorm-runtime";

export const SCORM_BRIDGE_METHODS = {
  INITIALIZE: SCORM_12_API_METHODS.INITIALIZE,
  SET_VALUE: SCORM_12_API_METHODS.SET_VALUE,
  COMMIT: SCORM_12_API_METHODS.COMMIT,
  FINISH: SCORM_12_API_METHODS.FINISH,
} as const;

export const SCORM_BRIDGE_MESSAGE_TYPES = {
  READY: "mentingo:scorm:ready",
  INITIALIZE: "mentingo:scorm:initialize",
  CALL: "mentingo:scorm:call",
} as const;

export const SCORM_BRIDGE_CONFIG = {
  READY_RETRY_INTERVAL_MS: 500,
  READY_TIMEOUT_MS: 30_000,
  MAX_KEY_LENGTH: 255,
  MAX_VALUE_LENGTH: 4096,
  SESSION_PATTERN: "^[a-f0-9-]{36}$",
} as const;
