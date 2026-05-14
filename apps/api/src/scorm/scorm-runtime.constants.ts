export const SCORM_1_2_CMI_KEYS = {
  LESSON_STATUS: "cmi.core.lesson_status",
  SCORE_RAW: "cmi.core.score.raw",
  SCORE_MIN: "cmi.core.score.min",
  SCORE_MAX: "cmi.core.score.max",
  LESSON_LOCATION: "cmi.core.lesson_location",
  SUSPEND_DATA: "cmi.suspend_data",
  SESSION_TIME: "cmi.core.session_time",
  TOTAL_TIME: "cmi.core.total_time",
  ENTRY: "cmi.core.entry",
  EXIT: "cmi.core.exit",
} as const;

export const SCORM_1_2_ALLOWED_RUNTIME_KEY_PATTERNS = [
  /^cmi\.core\.(lesson_status|score\.(raw|min|max)|lesson_location|session_time|exit)$/u,
  /^cmi\.suspend_data$/u,
  /^cmi\.comments$/u,
  /^cmi\.objectives\.\d+\.(id|score\.(raw|min|max)|status)$/u,
  /^cmi\.interactions\.\d+\.(id|type|timestamp|weighting|student_response|result|latency)$/u,
  /^cmi\.interactions\.\d+\.objectives\.\d+\.id$/u,
  /^cmi\.interactions\.\d+\.correct_responses\.\d+\.pattern$/u,
] as const;

export const SCORM_1_2_VALUE_LIMITS = {
  DEFAULT_MAX_LENGTH: 4096,
  SUSPEND_DATA_MAX_LENGTH: 4096,
  LESSON_LOCATION_MAX_LENGTH: 255,
  EXIT_MAX_LENGTH: 255,
} as const;

export const SCORM_1_2_LESSON_STATUS = {
  PASSED: "passed",
  COMPLETED: "completed",
  FAILED: "failed",
  INCOMPLETE: "incomplete",
  BROWSED: "browsed",
  NOT_ATTEMPTED: "not attempted",
} as const;

export const SCORM_1_2_INITIAL_ENTRY = {
  NEW: "ab-initio",
  RESUME: "resume",
} as const;
