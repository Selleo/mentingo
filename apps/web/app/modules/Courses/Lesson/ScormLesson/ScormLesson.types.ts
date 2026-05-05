import type { LaunchScormAttemptResponse } from "~/api/generated-api";

export type ScormLaunchData = LaunchScormAttemptResponse["data"];

export type ScormRuntimeValues = Record<string, string>;
