import type { SupportedLanguages } from "@repo/shared";
import type { DatabasePg, UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type {
  LumaAiMentorContextIngestion,
  LumaGeneratedCourseAsset,
  LumaGeneratedCourseImportStats,
  LumaGeneratedCourseLesson,
  LumaGeneratedCourseQuestionOption,
} from "src/luma/luma.types";
import type { QuestionType } from "src/questions/schema/question.types";

type LumaGeneratedCourseImportDbContext = {
  language: SupportedLanguages;
  currentUser: CurrentUserType;
  trx: DatabasePg;
};

type LumaGeneratedCourseLessonAssetContext = {
  assetMap: Map<string, LumaGeneratedCourseAsset>;
  stats: LumaGeneratedCourseImportStats;
};

export type InsertChapterData = LumaGeneratedCourseImportDbContext & {
  courseId: UUIDType;
  title: string;
  displayOrder: number;
};

export type InsertContentLessonData = LumaGeneratedCourseImportDbContext &
  LumaGeneratedCourseLessonAssetContext & {
    chapterId: UUIDType;
    lesson: LumaGeneratedCourseLesson;
    displayOrder: number;
  };

export type InsertAiMentorLessonData = InsertContentLessonData & {
  contextIngestions: LumaAiMentorContextIngestion[];
};

export type InsertQuizLessonData = InsertContentLessonData;

export type InsertLessonData = InsertContentLessonData & {
  contextIngestions: LumaAiMentorContextIngestion[];
};

export type InsertQuestionOptionsData = {
  questionId: UUIDType;
  questionType: QuestionType;
  options: LumaGeneratedCourseQuestionOption[];
  language: SupportedLanguages;
  trx: DatabasePg;
};

export type ImportLessonAssetsData = LumaGeneratedCourseImportDbContext &
  LumaGeneratedCourseLessonAssetContext & {
    lessonId: UUIDType;
    description: string;
    lessonAssets: LumaGeneratedCourseLesson["assets"];
  };

export type ImportReadyAssetByIdData = {
  lessonId: UUIDType;
  assetId: string;
  assetMap: Map<string, LumaGeneratedCourseAsset>;
  currentUser: CurrentUserType;
  stats: LumaGeneratedCourseImportStats;
  trx: DatabasePg;
};

export type ImportAssetWithRetryData = {
  lessonId: UUIDType;
  assetId: string;
  signedUrl: string;
  currentUser: CurrentUserType;
  trx: DatabasePg;
};

export type ImportAssetData = ImportAssetWithRetryData;

export type BuildImageNodeHtmlData = {
  resourceId: UUIDType;
  alt: string;
};
