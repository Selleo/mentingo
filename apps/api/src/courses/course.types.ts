import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

export type CourseStatisticsExpressionsParams = {
  courseId: UUIDType;
  language: SupportedLanguages;
  currentUser?: CurrentUserType;
};

/** Trusted domain read context, never populated from client query parameters. */
export type CourseReadOptions = { learnerOnly?: boolean };
