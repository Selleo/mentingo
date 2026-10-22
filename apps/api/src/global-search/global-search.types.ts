import type {
  SEARCH_DOCUMENT_TYPES,
  SEARCH_DOCUMENT_WEIGHTS,
  SEARCH_ENTITY_TYPES,
} from "./global-search.constants";
import type { GlobalSearchResult } from "./schemas/global-search.schema";
import type { SupportedLanguages } from "@repo/shared";
import type { SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { DatabasePg, UUIDType } from "src/common";

export type SearchEntityType = (typeof SEARCH_ENTITY_TYPES)[keyof typeof SEARCH_ENTITY_TYPES];
export type SearchDocumentType = (typeof SEARCH_DOCUMENT_TYPES)[keyof typeof SEARCH_DOCUMENT_TYPES];
export type SearchDocumentWeight =
  (typeof SEARCH_DOCUMENT_WEIGHTS)[keyof typeof SEARCH_DOCUMENT_WEIGHTS];

export type SearchDocumentInput = {
  documentType: string;
  language: SupportedLanguages;
  content: string;
  weight: SearchDocumentWeight;
  metadata?: Record<string, unknown>;
};

export type SearchDocumentSqlExpression<T = unknown> = SQL<T> | AnyPgColumn;

export type LessonLocalizedFieldQueryInput = {
  db: DatabasePg;
  lessonIds: UUIDType[];
  fieldExpression: SearchDocumentSqlExpression;
  lateralAlias: string;
  documentType: string;
  weight: SearchDocumentWeight;
};

export type QuestionLocalizedFieldQueryInput = {
  db: DatabasePg;
  lessonIds: UUIDType[];
  fieldExpression: SearchDocumentSqlExpression;
  lateralAlias: string;
  documentType: SQL<string>;
  weight: SearchDocumentWeight;
  metadata: SQL<Record<string, unknown>>;
};

export type DocumentSelectionInput = {
  tenantId: SearchDocumentSqlExpression<UUIDType>;
  entityId: SearchDocumentSqlExpression<UUIDType>;
  documentType: SQL<string>;
  language: SQL<SupportedLanguages>;
  content: SQL<string>;
  weight: SearchDocumentWeight;
  metadata?: SQL<Record<string, unknown>>;
};

export type ReplaceSearchDocumentsInput = {
  entityType: SearchEntityType;
  entityId: UUIDType;
  documents: SearchDocumentInput[];
  db?: DatabasePg;
};

export type DeleteSearchDocumentsInput = {
  entityType: SearchEntityType;
  entityId: UUIDType;
  db?: DatabasePg;
};

export type LocalizedRecord = unknown;

export type MatchRow = {
  entityId: UUIDType;
  languages: SupportedLanguages[];
  rank: number;
  matchedPassage?: string;
  matchedAttachmentFileName?: string | null;
};

/** Internal retrieval count controls bounded retries when many chunks share one entity. */
export type SemanticCandidateMatchRow = Omit<MatchRow, "entityId"> & {
  entityId: MatchRow["entityId"] | null;
  candidateCount: number;
};

export const GLOBAL_SEARCH_LESSON_ACCESS = {
  ALL: "all",
  OWN: "own",
  ENROLLED: "enrolled",
} as const;

export type GlobalSearchLessonAccess =
  (typeof GLOBAL_SEARCH_LESSON_ACCESS)[keyof typeof GLOBAL_SEARCH_LESSON_ACCESS];

/** Trusted integration projection and learner visibility controls. */
export type GlobalSearchReadOptions = {
  contentOnly?: boolean;
  learnerOnly?: boolean;
  /** Trusted MCP student:read opt-in; does not broaden regular learner or legacy search. */
  includeLearnerLessons?: boolean;
};

type GlobalSearchCourseRow = GlobalSearchResult["allCourses"][number];

/** A lesson row with the parent course fields needed when the course itself did not match. */
export type LessonWithParentRow = GlobalSearchResult["lessons"][number] & {
  courseThumbnailUrl?: string | null;
  courseCategory?: string | null;
};

export type SearchResultTreeInput = {
  /** Course lists in preference order; the first occurrence of a course wins. */
  courseLists: GlobalSearchCourseRow[][];
  lessons: LessonWithParentRow[];
  learningPaths: GlobalSearchResult["learningPaths"];
  news: GlobalSearchResult["news"];
  articles: GlobalSearchResult["articles"];
  qa: GlobalSearchResult["qa"];
};
