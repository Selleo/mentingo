import type {
  AiJudgeModelResult,
  AiJudgeRubric,
} from "src/ai/judge-configuration/judge-configuration.types";

export type RegressionCase = {
  id: string;
  flow: string;
  execution: "judge" | "search" | "mentor" | "authoring" | "assessment" | "prepared";
  provenance: "synthetic";
  reviewStatus: "pending_domain_review";
  input: Record<string, unknown>;
  expected: Record<string, unknown>;
  rubric: string[];
  sourcePaths: string[];
};

export type RegressionDataset = { version: 1; name: string; cases: RegressionCase[] };

export type JudgeInput = { rubric: AiJudgeRubric; result: AiJudgeModelResult };

export type CaseResult = {
  caseId: string;
  status: "passed" | "failed" | "needs_review" | "not_run";
  checks: Record<string, boolean>;
  evidence: Record<string, unknown>;
  reason?: string;
};

/** Cookies remain in memory and are never written into evaluation evidence. */
export type HttpFixture = {
  cookieEnv: string;
  /** Expected identity returned by the real authenticated current-user endpoint. */
  actorUserId?: string;
  threadId?: string;
  courseId?: string;
  expectedResultIds?: string[];
  forbiddenResultIds?: string[];
  blockingErrorIds?: Record<string, string>;
  lessonId?: string;
  rubricCookieEnv?: string;
  expectedSourceUrls?: string[];
  forbiddenSourceUrls?: string[];
  /** Explicit synthetic source fixture for native authoring requests. */
  authoringSourceText?: string;
  /** Explicit continuation of one saved native clarification; never creates another request. */
  authoringResumeSessionId?: string;
  audioPath?: string;
  audioSha256?: string;
  audioWavPath?: string;
  audioWavSha256?: string;
  audioSampleRate?: number;
  /** Exact UUIDs of distinct fixtures whose content was prepared for this case. */
  isolated: true;
};

export type HttpRunConfig = {
  baseUrl: string;
  disposableTenant: true;
  allowAuthoringWrites?: true;
  fixtures: Record<string, HttpFixture>;
};

export type NativeHttpExchange = {
  method: string;
  path: string;
  httpStatus: number;
  responseSha256: string;
  response: unknown;
};
