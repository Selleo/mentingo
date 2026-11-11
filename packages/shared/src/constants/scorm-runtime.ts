export const SCORM_12_API_METHODS = {
  INITIALIZE: "LMSInitialize",
  SET_VALUE: "LMSSetValue",
  COMMIT: "LMSCommit",
  FINISH: "LMSFinish",
  GET_VALUE: "LMSGetValue",
  GET_LAST_ERROR: "LMSGetLastError",
  GET_ERROR_STRING: "LMSGetErrorString",
  GET_DIAGNOSTIC: "LMSGetDiagnostic",
} as const;

export const SCORM_12_RUNTIME_SETTINGS = {
  autocommit: false,
  dataCommitFormat: "flattened",
  logLevel: "ERROR",
  sendFullCommit: false,
} as const;
