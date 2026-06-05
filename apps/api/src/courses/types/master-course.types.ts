import type { EntityType } from "@repo/shared";
import type { InferInsertModel, InferSelectModel, SQL } from "drizzle-orm";
import type { ResourceRelationshipType } from "src/file/file.constants";
import type {
  aiMentorLessons,
  categories,
  chapters,
  courses,
  docChunks,
  documents,
  documentToAiMentorLesson,
  lessons,
  masterCourseExports,
  questionAnswerOptions,
  questions,
  resourceEntity,
  resources,
  scormPackages,
  scormScos,
} from "src/storage/schema";

type ResourceWithRelation = {
  resource: ResourceSelect;
  relation: ResourceEntitySelect;
};

export type MasterCourseResourceGroupKey = "courses" | "chapters" | "lessons" | "questions";
export type MasterCourseResourceEntityType = Extract<
  EntityType,
  "course" | "chapter" | "lesson" | "question"
>;

export const MASTER_COURSE_RESOURCE_REFERENCE_KIND = {
  EXTERNAL: "external",
  INTERNAL: "internal",
} as const;

export type MasterCourseResourceReferenceKind =
  (typeof MASTER_COURSE_RESOURCE_REFERENCE_KIND)[keyof typeof MASTER_COURSE_RESOURCE_REFERENCE_KIND];

export type MasterCourseCopySourceReference = {
  reference: string;
  contentType?: string | null;
  filename?: string | null;
  isVideo?: boolean;
};

type MasterCourseResourceReferenceBase = {
  group: MasterCourseResourceGroupKey;
  source: {
    entityType: MasterCourseResourceEntityType;
    entityId: string;
    reference: string;
    contentType?: string | null;
    filename?: string | null;
    isVideo?: boolean;
  };
  target: {
    entityId: string | null;
    reference: string | null;
  };
};

export type MasterCourseExternalResourceReference = MasterCourseResourceReferenceBase & {
  kind: typeof MASTER_COURSE_RESOURCE_REFERENCE_KIND.EXTERNAL;
  source: MasterCourseResourceReferenceBase["source"] & {
    resourceId: string;
    relationshipType: ResourceRelationshipType | string;
    resource: ResourceSelect;
    relation?: ResourceEntitySelect;
  };
  target: MasterCourseResourceReferenceBase["target"] & {
    resourceId: string | null;
    relationshipType: ResourceRelationshipType | string;
  };
};

export type MasterCourseInternalResourceReference = MasterCourseResourceReferenceBase & {
  kind: typeof MASTER_COURSE_RESOURCE_REFERENCE_KIND.INTERNAL;
  source: MasterCourseResourceReferenceBase["source"] & {
    fieldPath: string;
  };
};

export type MasterCourseResourceReferences = {
  external: Record<string, MasterCourseExternalResourceReference>;
  internal: Record<string, MasterCourseInternalResourceReference>;
};

export type MasterCourseResourceCollection = Record<
  MasterCourseResourceGroupKey,
  MasterCourseResourceReferences
>;

export type CourseSelect = InferSelectModel<typeof courses>;
export type CourseInsert = InferInsertModel<typeof courses>;
export type CourseJsonbInsert = Omit<CourseInsert, "title" | "description" | "settings"> & {
  title: SQL<unknown>;
  description: SQL<unknown>;
  settings: SQL<unknown>;
};
export type CourseJsonbUpdate = Partial<
  Omit<CourseInsert, "title" | "description" | "settings">
> & {
  title?: SQL<unknown>;
  description?: SQL<unknown>;
  settings?: SQL<unknown>;
};

export type CategorySelect = InferSelectModel<typeof categories>;
export type CategoryInsert = InferInsertModel<typeof categories>;
export type CategoryJsonbInsert = Omit<CategoryInsert, "title"> & {
  title: SQL<unknown>;
};
export type CategoryJsonbUpdate = Partial<Omit<CategoryInsert, "title">> & {
  title?: SQL<unknown>;
};

export type ChapterSelect = InferSelectModel<typeof chapters>;
export type ChapterInsert = InferInsertModel<typeof chapters>;
export type ChapterJsonbInsert = Omit<ChapterInsert, "title"> & {
  title: SQL<unknown>;
};
export type ChapterJsonbUpdate = Partial<Omit<ChapterInsert, "title">> & {
  title?: SQL<unknown>;
};

export type LessonSelect = InferSelectModel<typeof lessons>;
export type LessonInsert = InferInsertModel<typeof lessons>;
export type LessonJsonbInsert = Omit<LessonInsert, "title" | "description"> & {
  title: SQL<unknown>;
  description?: SQL<unknown> | null;
};
export type LessonJsonbUpdate = Partial<Omit<LessonInsert, "title" | "description">> & {
  title?: SQL<unknown>;
  description?: SQL<unknown> | null;
};

export type QuestionSelect = InferSelectModel<typeof questions>;
export type QuestionInsert = InferInsertModel<typeof questions>;
export type QuestionJsonbInsert = Omit<
  QuestionInsert,
  "title" | "description" | "solutionExplanation"
> & {
  title: SQL<unknown>;
  description?: SQL<unknown> | null;
  solutionExplanation?: SQL<unknown> | null;
};
export type QuestionJsonbUpdate = Partial<
  Omit<QuestionInsert, "title" | "description" | "solutionExplanation">
> & {
  title?: SQL<unknown>;
  description?: SQL<unknown> | null;
  solutionExplanation?: SQL<unknown> | null;
};

export type QuestionAnswerOptionSelect = InferSelectModel<typeof questionAnswerOptions>;
export type QuestionAnswerOptionInsert = InferInsertModel<typeof questionAnswerOptions>;
export type QuestionAnswerOptionJsonbInsert = Omit<
  QuestionAnswerOptionInsert,
  "optionText" | "matchedWord"
> & {
  optionText: SQL<unknown>;
  matchedWord?: SQL<unknown> | null;
};
export type QuestionAnswerOptionJsonbUpdate = Partial<
  Omit<QuestionAnswerOptionInsert, "optionText" | "matchedWord">
> & {
  optionText?: SQL<unknown>;
  matchedWord?: SQL<unknown> | null;
};

export type AiMentorLessonSelect = InferSelectModel<typeof aiMentorLessons>;
export type AiMentorLessonInsert = InferInsertModel<typeof aiMentorLessons>;

export type DocumentSelect = InferSelectModel<typeof documents>;
export type DocumentInsert = InferInsertModel<typeof documents>;

export type DocChunkSelect = InferSelectModel<typeof docChunks>;
export type DocChunkInsert = InferInsertModel<typeof docChunks>;

export type DocumentToAiMentorLessonSelect = InferSelectModel<typeof documentToAiMentorLesson>;
export type DocumentToAiMentorLessonInsert = InferInsertModel<typeof documentToAiMentorLesson>;

export type ResourceSelect = InferSelectModel<typeof resources>;
export type ResourceInsert = InferInsertModel<typeof resources>;

export type ResourceEntitySelect = InferSelectModel<typeof resourceEntity>;
export type ResourceEntityInsert = InferInsertModel<typeof resourceEntity>;

export type ScormPackageSelect = InferSelectModel<typeof scormPackages>;
export type ScormPackageInsert = InferInsertModel<typeof scormPackages>;

export type ScormScoSelect = InferSelectModel<typeof scormScos>;
export type ScormScoInsert = InferInsertModel<typeof scormScos>;

export type MasterCourseExportRecord = InferSelectModel<typeof masterCourseExports>;

export type SourceSnapshot = {
  course: CourseSelect;
  category: CategorySelect;
  categoryBaseTitle: string;
  chapters: Array<ChapterSelect>;
  lessons: Array<LessonSelect>;
  questions: Array<QuestionSelect>;
  options: Array<QuestionAnswerOptionSelect>;
  aiMentors: Array<AiMentorLessonSelect>;
  aiMentorDocumentLinks: Array<DocumentToAiMentorLessonSelect>;
  aiMentorDocuments: Array<DocumentSelect>;
  aiMentorDocChunks: Array<DocChunkSelect>;
  scormPackages: Array<ScormPackageSelect>;
  scormScos: Array<ScormScoSelect>;
  lessonContentResources: Array<ResourceSelect>;
  lessonResources: Array<ResourceWithRelation>;
  courseResources: Array<ResourceWithRelation>;
};
