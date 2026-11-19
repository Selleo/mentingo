import type { ReportCourseActivity } from "./reports-api.types";
import type {
  ACTIVITY_PERIOD_PRESETS,
  ACTIVITY_SUBJECTS,
  INACTIVITY_LEVELS,
} from "../constants/courseActivity.constants";

export type ActivityPeriodPreset =
  (typeof ACTIVITY_PERIOD_PRESETS)[keyof typeof ACTIVITY_PERIOD_PRESETS];

export type RollingActivityPeriodPreset = Exclude<
  ActivityPeriodPreset,
  typeof ACTIVITY_PERIOD_PRESETS.CUSTOM
>;

export type InactivityLevel = (typeof INACTIVITY_LEVELS)[keyof typeof INACTIVITY_LEVELS];

export type CourseActivityItem = ReportCourseActivity["popular"][number];

export type CourseActivityBar = CourseActivityItem & { value: number };

export type ActivitySubject = (typeof ACTIVITY_SUBJECTS)[keyof typeof ACTIVITY_SUBJECTS];

export type ActivitySubjectLabelKeys = {
  title: string;
  popular: string;
  inactive: string;
  topSubject: string;
  neverActive: string;
};
