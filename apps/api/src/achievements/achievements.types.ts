export const VALIDATE_THRESHOLD_TYPE = {
  POST: "post",
  UPDATE: "update",
} as const;

export type validateThresholdType =
  (typeof VALIDATE_THRESHOLD_TYPE)[keyof typeof VALIDATE_THRESHOLD_TYPE];
