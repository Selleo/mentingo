import type { IntegrationKeyMetadata } from "./schemas/integration-key.schema";
import type { Request } from "express";
import type { CurrentUserType } from "src/common/types/current-user.type";

export type IntegrationKeyMetadataRecord = {
  id: string;
  keyPrefix: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
};

export type RotateIntegrationKeyParams = {
  userId: string;
  tenantId: string;
  keyPrefix: string;
  keyHash: string;
};

export type FindIntegrationKeyCandidateParams = {
  keyPrefix: string;
};

export type IntegrationApiKeyCandidate = {
  keyId: string;
  keyHash: string;
  keyTenantId: string;
  keyTenantIsManaging: boolean;
  userId: string;
  userEmail: string;
  userDeletedAt: string | null;
};

export type IntegrationRequest = Request & {
  user?: CurrentUserType;
  integrationTenantValidated?: boolean;
  integrationApiKeyId?: string;
};

export type CurrentAdminKeyData = {
  key: IntegrationKeyMetadata | null;
};

export type RotateAdminKeyData = {
  key: string;
  metadata: IntegrationKeyMetadata;
};

export const INTEGRATION_TRAINING_RESULTS_SCOPES = {
  TENANT: "tenant",
  STUDENT: "student",
  COURSE: "course",
} as const;

export type IntegrationTrainingResultsScope =
  (typeof INTEGRATION_TRAINING_RESULTS_SCOPES)[keyof typeof INTEGRATION_TRAINING_RESULTS_SCOPES];

export type IntegrationTrainingResultsQuery = {
  scope: IntegrationTrainingResultsScope;
  studentId?: string;
  courseId?: string;
  page?: number;
  perPage?: number;
};

export type IntegrationTrainingResultRow = {
  scope: IntegrationTrainingResultsScope;
  tenantId: string;
  student: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    fullName: string;
  };
  courses: IntegrationTrainingResultCourse[];
};

export type IntegrationTrainingResultCourse = {
  id: string;
  title: string;
  lessons: IntegrationTrainingResultLesson[];
  quizzes: IntegrationTrainingResultQuiz[];
  certificate: IntegrationTrainingResultCertificate;
};

export type IntegrationTrainingResultLesson = {
  lessonId: string;
  chapterId: string;
  title: string;
  type: string;
  completed: boolean;
  completedAt: string | null;
};

export type IntegrationTrainingResultQuiz = {
  lessonId: string;
  chapterId: string;
  title: string;
  score: number | null;
  passed: boolean | null;
  attempts: number | null;
  completedAt: string | null;
};

export type IntegrationTrainingResultCertificate = {
  enabled: boolean;
  status: "issued" | "not_issued" | "not_applicable";
  issuedAt: string | null;
};

export type IntegrationTrainingResultsData = {
  data: IntegrationTrainingResultRow[];
  pagination: {
    totalItems: number;
    page: number;
    perPage: number;
  };
};
