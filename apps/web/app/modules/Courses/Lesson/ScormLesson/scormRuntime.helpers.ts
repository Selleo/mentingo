import { Scorm12API } from "scorm-again";

import type { ScormRuntimeValues } from "./ScormLesson.types";

type ScormWindow = Window & {
  API?: Scorm12API;
};

export const SCORM_RUNTIME_ERROR_KEY = "studentLessonView.scorm.saveFailed";
export const SCORM_SET_VALUE_EVENT = "LMSSetValue.cmi.*";
export const SCORM_COMMIT_EVENT = "LMSCommit";
export const SCORM_FINISH_EVENT = "LMSFinish";

const SCORM_1_2_WRITABLE_RUNTIME_KEY_PATTERNS = [
  /^cmi\.core\.(lesson_status|score\.(raw|min|max)|lesson_location|session_time|exit)$/u,
  /^cmi\.suspend_data$/u,
  /^cmi\.comments$/u,
  /^cmi\.objectives\.\d+\.(id|score\.(raw|min|max)|status)$/u,
  /^cmi\.interactions\.\d+\.(id|type|timestamp|weighting|student_response|result|latency)$/u,
  /^cmi\.interactions\.\d+\.objectives\.\d+\.id$/u,
  /^cmi\.interactions\.\d+\.correct_responses\.\d+\.pattern$/u,
] as const;

export function createScorm12Api() {
  return new Scorm12API({
    autocommit: false,
    dataCommitFormat: "flattened",
    logLevel: "ERROR",
    sendFullCommit: false,
  });
}

export function exposeScormApi(api: Scorm12API) {
  const scormWindow = window as ScormWindow;

  scormWindow.API = api;
}

export function removeScormApi(api: Scorm12API) {
  const scormWindow = window as ScormWindow;

  if (scormWindow.API !== api) {
    return;
  }

  delete scormWindow.API;
}

export function hasRuntimeValues(values: ScormRuntimeValues) {
  return Object.keys(values).length > 0;
}

export function filterWritableRuntimeValues(values: ScormRuntimeValues) {
  const writableValues: ScormRuntimeValues = {};

  for (const [key, value] of Object.entries(values)) {
    if (!isWritableRuntimeKey(key)) {
      continue;
    }

    writableValues[key] = value;
  }

  return writableValues;
}

export function asRuntimeValues(value: unknown): ScormRuntimeValues {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const runtimeValues: ScormRuntimeValues = {};

  for (const [key, entryValue] of Object.entries(value)) {
    if (typeof entryValue !== "string") {
      continue;
    }

    runtimeValues[key] = entryValue;
  }

  return runtimeValues;
}

function isWritableRuntimeKey(key: string) {
  return SCORM_1_2_WRITABLE_RUNTIME_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

export function readRenderedRuntimeValues(api: Scorm12API | null) {
  if (!api) {
    return {};
  }

  return asRuntimeValues(api.renderCommitCMI(true, true));
}
