import type {
  SEARCH_DOCUMENT_TYPES,
  SEARCH_DOCUMENT_WEIGHTS,
  SEARCH_ENTITY_TYPES,
} from "./global-search.constants";
import type { SupportedLanguages } from "@repo/shared";
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
  rank: number;
};

export const GLOBAL_SEARCH_LESSON_ACCESS = {
  ALL: "all",
  OWN: "own",
  ENROLLED: "enrolled",
} as const;

export type GlobalSearchLessonAccess =
  (typeof GLOBAL_SEARCH_LESSON_ACCESS)[keyof typeof GLOBAL_SEARCH_LESSON_ACCESS];
