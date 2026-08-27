import type { AuditAnswer, AuditCompetency, AuditType } from "@repo/shared";
import type { UUIDType } from "src/common";

export type CreateAuditSubmissionBody = {
  definitionVersion: number;
  answers: AuditAnswer[];
};

export type AuditSubmissionResult = {
  id: UUIDType;
  type: AuditType;
  definitionVersion: number;
  score: number;
  competencyScores: Partial<Record<AuditCompetency, number>>;
  completedAt: string;
};

export type AuditBenchmarkComparison = {
  name: string;
  score: number;
  improvement: number | null;
  isCurrentTenant: boolean;
  rank: number;
};

export type AuditBenchmark = {
  currentScore: number | null;
  averageScore: number | null;
  improvement: number | null;
  rank: number | null;
  participantCount: number;
  comparisons: AuditBenchmarkComparison[];
};

export type AuditBenchmarkSubmission = {
  tenantId: UUIDType;
  name: string;
  score: number;
  submissionOrder: number;
};

export type CreateAuditSubmissionRecord = {
  type: AuditType;
  definitionVersion: number;
  submittedById: UUIDType;
  answers: AuditAnswer[];
  score: number;
  competencyScores: Partial<Record<AuditCompetency, number>>;
};
