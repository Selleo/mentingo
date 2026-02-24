import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type {
  aiMentorLessons,
  chapters,
  courses,
  lessons,
  masterCourseExports,
  questionAnswerOptions,
  questions,
  resourceEntity,
  resources,
} from "src/storage/schema";

type ResourceWithRelation = {
  resource: ResourceSelect;
  relation: ResourceEntitySelect;
};

export type CourseSelect = InferSelectModel<typeof courses>;
export type CourseInsert = InferInsertModel<typeof courses>;

export type ChapterSelect = InferSelectModel<typeof chapters>;
export type ChapterInsert = InferInsertModel<typeof chapters>;

export type LessonSelect = InferSelectModel<typeof lessons>;
export type LessonInsert = InferInsertModel<typeof lessons>;

export type QuestionSelect = InferSelectModel<typeof questions>;
export type QuestionInsert = InferInsertModel<typeof questions>;

export type QuestionAnswerOptionSelect = InferSelectModel<typeof questionAnswerOptions>;
export type QuestionAnswerOptionInsert = InferInsertModel<typeof questionAnswerOptions>;

export type AiMentorLessonSelect = InferSelectModel<typeof aiMentorLessons>;
export type AiMentorLessonInsert = InferInsertModel<typeof aiMentorLessons>;

export type ResourceSelect = InferSelectModel<typeof resources>;
export type ResourceInsert = InferInsertModel<typeof resources>;

export type ResourceEntitySelect = InferSelectModel<typeof resourceEntity>;
export type ResourceEntityInsert = InferInsertModel<typeof resourceEntity>;

export type MasterCourseExportRecord = InferSelectModel<typeof masterCourseExports>;

export type SourceSnapshot = {
  course: CourseSelect;
  categoryTitle: string;
  chapters: Array<ChapterSelect>;
  lessons: Array<LessonSelect>;
  questions: Array<QuestionSelect>;
  options: Array<QuestionAnswerOptionSelect>;
  aiMentors: Array<AiMentorLessonSelect>;
  lessonResources: Array<ResourceWithRelation>;
  courseResources: Array<ResourceWithRelation>;
};
