import {
  ARTICLE_STATUS,
  AI_MENTOR_TTS_PRESET,
  AI_MENTOR_VOICE_MODE,
  COURSE_STATUSES,
  ENTITY_TYPES,
  LEARNING_PATH_STATUSES,
  NEWS_STATUS,
  ALLOWED_LESSON_IMAGE_FILE_TYPES,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";
import { Type } from "@sinclair/typebox";

import { updateArticleTranslationSchema } from "src/articles/schemas/updateArticle.schema";
import { categoryLanguageSchema } from "src/category/schemas/category.schema";
import { sortCategoryFieldsOptions } from "src/category/schemas/categoryQuery";
import { categoryCreateSchema } from "src/category/schemas/createCategorySchema";
import { createCourseSchema } from "src/courses/schemas/createCourse.schema";
import { updateCourseSchema } from "src/courses/schemas/updateCourse.schema";
import { certificateValiditySchema } from "src/courses/types/settings";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE, MAX_VIDEO_SIZE } from "src/file/file.constants";
import { aiJudgeConfigurationInputSchema } from "src/lesson/ai-judge-configuration/ai-judge-configuration.schema";
import { aiMentorConfigurationContentSchema } from "src/lesson/ai-mentor-configuration/schemas/ai-mentor-configuration.schema";
import {
  adminQuestionSchema,
  attachLiveTrainingLessonSchema,
  createLiveTrainingLessonSchema,
} from "src/lesson/lesson.schema";
import { MAX_SCORM_THUMBNAIL_SIZE } from "src/scorm/pipes/validate-scorm-course-files.pipe";
import {
  MAX_SCORM_PACKAGE_SIZE_BYTES,
  SCORM_PACKAGE_MIME_TYPES,
} from "src/scorm/scorm-package-limits";

import { MCP_RESOURCE_DISPLAY_MODES } from "./mcp-content-resource";

const languageInputSchema = Type.Enum(SUPPORTED_LANGUAGES);
const uuidInputSchema = Type.String({ format: "uuid" });
const revisionInputSchema = Type.String({ minLength: 1 });
const idempotencyKeyInputSchema = Type.String({ minLength: 8, maxLength: 128 });

export const getMyCapabilitiesInputSchema = Type.Object({}, { additionalProperties: false });

export const listCoursesInputSchema = Type.Object(
  {
    language: languageInputSchema,
    query: Type.Optional(Type.String({ maxLength: 200 })),
    status: Type.Optional(Type.Enum(COURSE_STATUSES)),
    page: Type.Optional(Type.Integer({ minimum: 1 })),
    pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
  },
  { additionalProperties: false },
);

export const getCourseInputSchema = Type.Object(
  { courseId: uuidInputSchema, language: languageInputSchema },
  { additionalProperties: false },
);

export const getCourseSettingsInputSchema = Type.Object(
  { courseId: uuidInputSchema, language: languageInputSchema },
  { additionalProperties: false },
);

export const listCourseGroupDeadlinesInputSchema = Type.Object(
  { courseId: uuidInputSchema, language: languageInputSchema },
  { additionalProperties: false },
);

export const setCourseGroupDeadlineInputSchema = Type.Object(
  {
    courseId: uuidInputSchema,
    groupId: uuidInputSchema,
    dueDate: Type.Union([Type.String({ format: "date-time" }), Type.Null()], {
      description: "ISO 8601 timestamp with timezone, or null to clear the deadline.",
    }),
  },
  { additionalProperties: false },
);

export const listChaptersInputSchema = Type.Object(
  { courseId: uuidInputSchema, language: languageInputSchema },
  { additionalProperties: false },
);

export const listCourseLanguagesInputSchema = getCourseInputSchema;
export const getChapterInputSchema = Type.Object(
  { courseId: uuidInputSchema, chapterId: uuidInputSchema, language: languageInputSchema },
  { additionalProperties: false },
);

export const setCourseStatusInputSchema = Type.Object(
  {
    courseId: uuidInputSchema,
    language: languageInputSchema,
    status: Type.Enum(COURSE_STATUSES),
    expectedRevision: revisionInputSchema,
    confirmPublish: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const deleteCourseInputSchema = Type.Object(
  {
    courseId: uuidInputSchema,
    language: languageInputSchema,
    expectedRevision: revisionInputSchema,
    confirmTitle: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export const setCourseCertificateEnabledInputSchema = Type.Object(
  {
    courseId: uuidInputSchema,
    language: languageInputSchema,
    enabled: Type.Boolean(),
    expectedRevision: revisionInputSchema,
  },
  { additionalProperties: false },
);

export const setCoursePricingInputSchema = Type.Object(
  {
    courseId: uuidInputSchema,
    language: languageInputSchema,
    priceInCents: Type.Integer({ minimum: 0 }),
    currency: Type.String({ minLength: 3, maxLength: 3, pattern: "^[A-Za-z]{3}$" }),
    expectedRevision: revisionInputSchema,
  },
  { additionalProperties: false },
);

export const updateCourseMediaInputSchema = Type.Object(
  {
    courseId: uuidInputSchema,
    language: languageInputSchema,
    thumbnailPositionY: Type.Integer({ minimum: 0, maximum: 100 }),
    expectedRevision: revisionInputSchema,
  },
  { additionalProperties: false },
);

export const reorderChapterInputSchema = Type.Object(
  {
    courseId: uuidInputSchema,
    chapterId: uuidInputSchema,
    language: languageInputSchema,
    displayOrder: Type.Integer({ minimum: 1 }),
    expectedRevision: revisionInputSchema,
  },
  { additionalProperties: false },
);

export const deleteChapterInputSchema = Type.Object(
  {
    courseId: uuidInputSchema,
    chapterId: uuidInputSchema,
    language: languageInputSchema,
    expectedRevision: revisionInputSchema,
    confirmTitle: Type.String({ minLength: 1 }),
    confirmLessonIds: Type.Array(uuidInputSchema, { uniqueItems: true }),
  },
  { additionalProperties: false },
);

export const reorderLessonInputSchema = Type.Object(
  {
    courseId: uuidInputSchema,
    chapterId: uuidInputSchema,
    lessonId: uuidInputSchema,
    language: languageInputSchema,
    displayOrder: Type.Integer({ minimum: 1 }),
    expectedRevision: revisionInputSchema,
  },
  { additionalProperties: false },
);

export const deleteLessonInputSchema = Type.Object(
  {
    courseId: uuidInputSchema,
    chapterId: uuidInputSchema,
    lessonId: uuidInputSchema,
    language: languageInputSchema,
    expectedRevision: revisionInputSchema,
    confirmTitle: Type.String({ minLength: 1 }),
    confirmType: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export const listLessonResourcesInputSchema = Type.Object(
  {
    courseId: uuidInputSchema,
    chapterId: uuidInputSchema,
    lessonId: uuidInputSchema,
    language: languageInputSchema,
  },
  { additionalProperties: false },
);
export const insertLessonResourceInputSchema = Type.Object(
  {
    courseId: uuidInputSchema,
    chapterId: uuidInputSchema,
    lessonId: uuidInputSchema,
    resourceId: uuidInputSchema,
    language: languageInputSchema,
    displayMode: Type.Enum(MCP_RESOURCE_DISPLAY_MODES, {
      description:
        "Use preview for images, videos, PDFs and presentations; use download for PDFs, presentations and documents.",
    }),
    expectedRevision: revisionInputSchema,
  },
  { additionalProperties: false },
);
export const removeLessonResourceInputSchema = Type.Object(
  {
    courseId: uuidInputSchema,
    chapterId: uuidInputSchema,
    lessonId: uuidInputSchema,
    resourceId: uuidInputSchema,
    language: languageInputSchema,
    expectedRevision: revisionInputSchema,
    confirmResourceId: uuidInputSchema,
  },
  { additionalProperties: false },
);

export const listArticlesInputSchema = Type.Object(
  {
    language: languageInputSchema,
    status: Type.Optional(Type.Enum(ARTICLE_STATUS)),
    query: Type.Optional(Type.String({ maxLength: 200 })),
    page: Type.Optional(Type.Integer({ minimum: 1 })),
  },
  { additionalProperties: false },
);

export const setNewsStatusInputSchema = Type.Object(
  {
    id: uuidInputSchema,
    language: languageInputSchema,
    status: Type.Enum(NEWS_STATUS),
    expectedRevision: revisionInputSchema,
    confirmPublish: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const requestAuthoringUploadInputSchema = Type.Object(
  {
    targetType: Type.Union([
      Type.Literal(ENTITY_TYPES.LESSON),
      Type.Literal(ENTITY_TYPES.ARTICLES),
      Type.Literal(ENTITY_TYPES.NEWS),
    ]),
    targetId: uuidInputSchema,
    language: languageInputSchema,
    filename: Type.String({ minLength: 1, maxLength: 255 }),
    mimeType: Type.String({ minLength: 3, maxLength: 200 }),
    size: Type.Integer({ minimum: 1, maximum: MAX_VIDEO_SIZE }),
  },
  { additionalProperties: false },
);

export const getVideoUploadStatusInputSchema = Type.Object(
  { uploadId: uuidInputSchema },
  { additionalProperties: false },
);

export const requestCourseUploadInputSchema = Type.Object(
  {
    courseId: uuidInputSchema,
    language: languageInputSchema,
    kind: Type.Union([Type.Literal("thumbnail"), Type.Literal("certificateSignature")]),
    filename: Type.String({ minLength: 1, maxLength: 255 }),
    mimeType: Type.String({ minLength: 3, maxLength: 200 }),
    size: Type.Integer({ minimum: 1, maximum: MAX_FILE_SIZE }),
    thumbnailPositionY: Type.Optional(Type.Integer({ minimum: 0, maximum: 100 })),
  },
  { additionalProperties: false },
);

export const requestDevelopmentPathUploadInputSchema = Type.Object(
  {
    pathId: uuidInputSchema,
    kind: Type.Union([Type.Literal("thumbnail"), Type.Literal("certificateSignature")]),
    filename: Type.String({ minLength: 1, maxLength: 255 }),
    mimeType: Type.String({ minLength: 3, maxLength: 200 }),
    size: Type.Integer({ minimum: 1, maximum: MAX_FILE_SIZE }),
  },
  { additionalProperties: false },
);

export const requestEditorialCoverUploadInputSchema = Type.Object(
  {
    targetType: Type.Union([Type.Literal(ENTITY_TYPES.ARTICLES), Type.Literal(ENTITY_TYPES.NEWS)]),
    targetId: uuidInputSchema,
    language: languageInputSchema,
    filename: Type.String({ minLength: 1, maxLength: 255 }),
    mimeType: Type.String({ minLength: 3, maxLength: 200 }),
    size: Type.Integer({ minimum: 1, maximum: MAX_FILE_SIZE }),
    translations: Type.Array(updateArticleTranslationSchema, { minItems: 1 }),
  },
  { additionalProperties: false },
);

export const requestAiMentorAvatarUploadInputSchema = Type.Object(
  {
    lessonId: uuidInputSchema,
    filename: Type.String({ minLength: 1, maxLength: 255 }),
    mimeType: Type.String({ minLength: 3, maxLength: 200 }),
    size: Type.Integer({ minimum: 1, maximum: MAX_FILE_SIZE }),
  },
  { additionalProperties: false },
);

export const initVideoUploadInputSchema = Type.Object(
  {
    targetType: Type.Union([
      Type.Literal(ENTITY_TYPES.COURSE),
      Type.Literal(ENTITY_TYPES.LESSON),
      Type.Literal(ENTITY_TYPES.ARTICLES),
      Type.Literal(ENTITY_TYPES.NEWS),
    ]),
    targetId: uuidInputSchema,
    language: languageInputSchema,
    filename: Type.String({ minLength: 1, maxLength: 255 }),
    mimeType: Type.String({ minLength: 3, maxLength: 200 }),
    size: Type.Integer({ minimum: 1, maximum: MAX_VIDEO_SIZE }),
  },
  { additionalProperties: false },
);

const scormPackageInput = {
  filename: Type.String({ minLength: 5, maxLength: 255, pattern: "\\.zip$" }),
  mimeType: Type.Enum(SCORM_PACKAGE_MIME_TYPES),
  size: Type.Integer({ minimum: 1, maximum: MAX_SCORM_PACKAGE_SIZE_BYTES }),
  transport: Type.Optional(Type.Union([Type.Literal("multipart"), Type.Literal("tus")])),
};

export const requestGenericFileUploadInputSchema = Type.Object(
  {
    resource: Type.Union([Type.Literal(ENTITY_TYPES.COURSE), Type.Literal(ENTITY_TYPES.LESSON)]),
    filename: Type.String({ minLength: 1, maxLength: 255 }),
    mimeType: Type.Union(
      ALLOWED_MIME_TYPES.filter((type) => !type.startsWith("video/")).map((type) =>
        Type.Literal(type),
      ),
    ),
    size: Type.Integer({ minimum: 1, maximum: MAX_FILE_SIZE }),
  },
  { additionalProperties: false },
);

const scormThumbnailInputSchema = Type.Object(
  {
    filename: Type.String({ minLength: 1, maxLength: 255 }),
    mimeType: Type.Union(ALLOWED_LESSON_IMAGE_FILE_TYPES.map((type) => Type.Literal(type))),
    size: Type.Integer({ minimum: 1, maximum: MAX_SCORM_THUMBNAIL_SIZE }),
  },
  { additionalProperties: false },
);

export const createScormCourseInputSchema = Type.Object(
  {
    title: Type.String({ minLength: 1, maxLength: 500 }),
    description: Type.String({ maxLength: 20000 }),
    categoryId: uuidInputSchema,
    language: languageInputSchema,
    ...scormPackageInput,
    thumbnail: Type.Optional(scormThumbnailInputSchema),
  },
  { additionalProperties: false },
);

export const createScormLessonInputSchema = Type.Object(
  {
    courseId: uuidInputSchema,
    chapterId: uuidInputSchema,
    title: Type.String({ minLength: 1, maxLength: 500 }),
    language: languageInputSchema,
    ...scormPackageInput,
  },
  { additionalProperties: false },
);

export const updateScormLessonInputSchema = Type.Object(
  {
    courseId: uuidInputSchema,
    chapterId: uuidInputSchema,
    lessonId: uuidInputSchema,
    title: Type.String({ minLength: 1, maxLength: 500 }),
    language: languageInputSchema,
    ...scormPackageInput,
  },
  { additionalProperties: false },
);

const quizQuestionsInputSchema = Type.Array(
  Type.Omit(adminQuestionSchema, ["photoS3Key"], { additionalProperties: false }),
  { minItems: 1 },
);

export const createQuizLessonInputSchema = Type.Object(
  {
    courseId: uuidInputSchema,
    chapterId: uuidInputSchema,
    language: languageInputSchema,
    idempotencyKey: idempotencyKeyInputSchema,
    title: Type.String({ minLength: 1, maxLength: 500 }),
    description: Type.Optional(Type.String({ maxLength: 100000 })),
    thresholdScore: Type.Integer({ minimum: 0, maximum: 100 }),
    attemptsLimit: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
    quizCooldownInHours: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
    questions: quizQuestionsInputSchema,
  },
  { additionalProperties: false },
);

export const updateQuizLessonInputSchema = Type.Object(
  {
    courseId: uuidInputSchema,
    chapterId: uuidInputSchema,
    lessonId: uuidInputSchema,
    language: languageInputSchema,
    expectedRevision: revisionInputSchema,
    title: Type.Optional(Type.String({ minLength: 1, maxLength: 500 })),
    description: Type.Optional(Type.String({ maxLength: 100000 })),
    thresholdScore: Type.Optional(Type.Integer({ minimum: 0, maximum: 100 })),
    attemptsLimit: Type.Optional(Type.Union([Type.Integer({ minimum: 1 }), Type.Null()])),
    quizCooldownInHours: Type.Optional(Type.Union([Type.Integer({ minimum: 0 }), Type.Null()])),
    questions: quizQuestionsInputSchema,
  },
  { additionalProperties: false },
);

const aiMentorFields = {
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 500 })),
  voiceMode: Type.Optional(Type.Enum(AI_MENTOR_VOICE_MODE)),
  ttsPreset: Type.Optional(Type.Enum(AI_MENTOR_TTS_PRESET)),
  customTtsReference: Type.Optional(Type.Union([Type.String(), Type.Null()])),
};

export const createAiMentorLessonInputSchema = Type.Object(
  {
    courseId: uuidInputSchema,
    chapterId: uuidInputSchema,
    language: languageInputSchema,
    idempotencyKey: idempotencyKeyInputSchema,
    title: Type.String({ minLength: 1, maxLength: 500 }),
    description: Type.Optional(Type.String({ maxLength: 100000 })),
    aiMentorConfiguration: aiMentorConfigurationContentSchema,
    aiJudgeConfiguration: aiJudgeConfigurationInputSchema,
    ...aiMentorFields,
  },
  { additionalProperties: false },
);

export const updateAiMentorLessonInputSchema = Type.Object(
  {
    courseId: uuidInputSchema,
    chapterId: uuidInputSchema,
    lessonId: uuidInputSchema,
    language: languageInputSchema,
    expectedRevision: revisionInputSchema,
    title: Type.Optional(Type.String({ minLength: 1, maxLength: 500 })),
    description: Type.Optional(Type.String({ maxLength: 100000 })),
    aiMentorConfiguration: Type.Optional(aiMentorConfigurationContentSchema),
    aiJudgeConfiguration: Type.Optional(aiJudgeConfigurationInputSchema),
    ...aiMentorFields,
  },
  { additionalProperties: false },
);

const embedResourceInputSchema = Type.Object(
  {
    id: Type.Optional(uuidInputSchema),
    fileUrl: Type.String({ format: "uri", pattern: "^https://" }),
    allowFullscreen: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const createEmbedLessonInputSchema = Type.Object(
  {
    courseId: uuidInputSchema,
    chapterId: uuidInputSchema,
    language: languageInputSchema,
    idempotencyKey: idempotencyKeyInputSchema,
    title: Type.String({ minLength: 1, maxLength: 500 }),
    resources: Type.Array(Type.Omit(embedResourceInputSchema, ["id"]), {
      minItems: 1,
      maxItems: 20,
    }),
  },
  { additionalProperties: false },
);

export const updateEmbedLessonInputSchema = Type.Object(
  {
    courseId: uuidInputSchema,
    chapterId: uuidInputSchema,
    lessonId: uuidInputSchema,
    language: languageInputSchema,
    expectedRevision: revisionInputSchema,
    title: Type.String({ minLength: 1, maxLength: 500 }),
    resources: Type.Array(embedResourceInputSchema, { maxItems: 20 }),
  },
  { additionalProperties: false },
);

export const createLiveTrainingLessonInputSchema = Type.Intersect([
  createLiveTrainingLessonSchema,
  Type.Object({ courseId: uuidInputSchema, idempotencyKey: idempotencyKeyInputSchema }),
]);

export const updateLiveTrainingLessonInputSchema = Type.Intersect([
  attachLiveTrainingLessonSchema,
  Type.Object({
    courseId: uuidInputSchema,
    chapterId: uuidInputSchema,
    lessonId: uuidInputSchema,
    expectedRevision: revisionInputSchema,
  }),
]);

export const listCourseCategoriesInputSchema = Type.Object(
  {
    language: languageInputSchema,
    query: Type.Optional(Type.String({ maxLength: 200 })),
    page: Type.Optional(Type.Integer({ minimum: 1 })),
  },
  { additionalProperties: false },
);

export const listCategoriesInputSchema = Type.Object(
  {
    language: categoryLanguageSchema,
    query: Type.Optional(Type.String({ maxLength: 200 })),
    page: Type.Optional(Type.Integer({ minimum: 1 })),
    pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
    sort: Type.Optional(sortCategoryFieldsOptions),
  },
  { additionalProperties: false },
);

export const getCategoryInputSchema = Type.Object(
  { categoryId: uuidInputSchema, language: categoryLanguageSchema },
  { additionalProperties: false },
);

export const createCategoryInputSchema = Type.Composite(
  [categoryCreateSchema, Type.Object({ idempotencyKey: idempotencyKeyInputSchema })],
  { additionalProperties: false },
);

export const updateCategoryInputSchema = Type.Object(
  {
    categoryId: uuidInputSchema,
    language: categoryLanguageSchema,
    title: Type.String({ minLength: 1 }),
    expectedRevision: revisionInputSchema,
  },
  { additionalProperties: false },
);

export const addCategoryLanguageInputSchema = Type.Object(
  {
    categoryId: uuidInputSchema,
    language: categoryLanguageSchema,
    expectedRevision: revisionInputSchema,
  },
  { additionalProperties: false },
);

export const removeCategoryLanguageInputSchema = Type.Object(
  {
    categoryId: uuidInputSchema,
    language: categoryLanguageSchema,
    confirmLanguage: categoryLanguageSchema,
    expectedRevision: revisionInputSchema,
  },
  { additionalProperties: false },
);

export const setCategoryBaseLanguageInputSchema = Type.Object(
  {
    categoryId: uuidInputSchema,
    baseLanguage: categoryLanguageSchema,
    expectedRevision: revisionInputSchema,
  },
  { additionalProperties: false },
);

export const deleteCategoryInputSchema = Type.Object(
  {
    categoryId: uuidInputSchema,
    language: categoryLanguageSchema,
    confirmTitle: Type.String({ minLength: 1 }),
    expectedRevision: revisionInputSchema,
  },
  { additionalProperties: false },
);

export const createCourseInputSchema = Type.Composite(
  [
    createCourseSchema,
    Type.Object({
      idempotencyKey: idempotencyKeyInputSchema,
      confirmPublish: Type.Optional(Type.Boolean()),
    }),
  ],
  { additionalProperties: false },
);

export const updateCourseInputSchema = Type.Composite(
  [
    updateCourseSchema,
    Type.Object({
      courseId: uuidInputSchema,
      language: languageInputSchema,
      expectedRevision: revisionInputSchema,
      confirmPublish: Type.Optional(Type.Boolean()),
    }),
  ],
  { additionalProperties: false },
);

export const updateCourseSettingsInputSchema = Type.Object(
  {
    courseId: uuidInputSchema,
    language: languageInputSchema,
    expectedRevision: revisionInputSchema,
    lessonSequenceEnabled: Type.Optional(Type.Boolean()),
    quizFeedbackEnabled: Type.Optional(Type.Boolean()),
    videoCompletionTrackingEnabled: Type.Optional(Type.Boolean()),
    certificateFontColor: Type.Optional(Type.String()),
    certificateValidity: Type.Optional(Type.Union([certificateValiditySchema, Type.Null()])),
    applyValidityToExistingCertificates: Type.Optional(Type.Boolean()),
    removeCertificateSignature: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const addCourseLanguageInputSchema = Type.Object(
  { courseId: uuidInputSchema, language: languageInputSchema },
  { additionalProperties: false },
);

export const removeCourseLanguageInputSchema = Type.Object(
  {
    courseId: uuidInputSchema,
    language: languageInputSchema,
    confirmLanguage: languageInputSchema,
  },
  { additionalProperties: false },
);

export const createChapterInputSchema = Type.Object(
  {
    courseId: uuidInputSchema,
    title: Type.String({ minLength: 1, maxLength: 500 }),
    idempotencyKey: idempotencyKeyInputSchema,
  },
  { additionalProperties: false },
);

export const updateChapterInputSchema = Type.Object(
  {
    courseId: uuidInputSchema,
    chapterId: uuidInputSchema,
    language: languageInputSchema,
    expectedRevision: revisionInputSchema,
    title: Type.String({ minLength: 1, maxLength: 500 }),
  },
  { additionalProperties: false },
);

export const listLessonsInputSchema = Type.Object(
  { courseId: uuidInputSchema, chapterId: uuidInputSchema, language: languageInputSchema },
  { additionalProperties: false },
);

export const getLessonInputSchema = Type.Object(
  {
    courseId: uuidInputSchema,
    chapterId: uuidInputSchema,
    lessonId: uuidInputSchema,
    language: languageInputSchema,
  },
  { additionalProperties: false },
);

export const createContentLessonInputSchema = Type.Object(
  {
    idempotencyKey: idempotencyKeyInputSchema,
    courseId: uuidInputSchema,
    chapterId: uuidInputSchema,
    language: languageInputSchema,
    title: Type.String({ minLength: 1, maxLength: 500 }),
    description: Type.Optional(Type.String({ maxLength: 100000 })),
  },
  { additionalProperties: false },
);

export const updateContentLessonInputSchema = Type.Object(
  {
    courseId: uuidInputSchema,
    chapterId: uuidInputSchema,
    lessonId: uuidInputSchema,
    language: languageInputSchema,
    expectedRevision: revisionInputSchema,
    title: Type.Optional(Type.String({ minLength: 1, maxLength: 500 })),
    description: Type.Optional(Type.String({ maxLength: 100000 })),
  },
  { additionalProperties: false },
);

export const deleteContentLessonInputSchema = Type.Object(
  {
    courseId: uuidInputSchema,
    chapterId: uuidInputSchema,
    lessonId: uuidInputSchema,
    language: languageInputSchema,
    expectedRevision: revisionInputSchema,
    confirmTitle: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export const listQaEntriesInputSchema = Type.Object(
  { language: languageInputSchema, page: Type.Optional(Type.Integer({ minimum: 1 })) },
  { additionalProperties: false },
);

export const getQaEntryInputSchema = Type.Object(
  { qaId: uuidInputSchema, language: languageInputSchema },
  { additionalProperties: false },
);

export const createQaEntryInputSchema = Type.Object(
  {
    idempotencyKey: idempotencyKeyInputSchema,
    language: languageInputSchema,
    title: Type.String({ minLength: 1, maxLength: 500 }),
    description: Type.String({ minLength: 1, maxLength: 100000 }),
  },
  { additionalProperties: false },
);

export const updateQaEntryInputSchema = Type.Object(
  {
    qaId: uuidInputSchema,
    language: languageInputSchema,
    title: Type.Optional(Type.String({ minLength: 1, maxLength: 500 })),
    description: Type.Optional(Type.String({ minLength: 1, maxLength: 100000 })),
  },
  { additionalProperties: false },
);

export const addQaLanguageInputSchema = Type.Object(
  { qaId: uuidInputSchema, language: languageInputSchema },
  { additionalProperties: false },
);

export const removeQaLanguageInputSchema = Type.Object(
  { qaId: uuidInputSchema, language: languageInputSchema, confirmLanguage: languageInputSchema },
  { additionalProperties: false },
);

export const deleteQaEntryInputSchema = Type.Object(
  {
    qaId: uuidInputSchema,
    language: languageInputSchema,
    confirmTitle: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export const listArticleSectionsInputSchema = Type.Object(
  { language: languageInputSchema },
  { additionalProperties: false },
);

export const getArticleSectionInputSchema = Type.Object(
  { id: uuidInputSchema, language: languageInputSchema },
  { additionalProperties: false },
);

export const createArticleSectionInputSchema = Type.Object(
  { language: languageInputSchema, idempotencyKey: idempotencyKeyInputSchema },
  { additionalProperties: false },
);

export const updateArticleSectionInputSchema = Type.Object(
  {
    id: uuidInputSchema,
    language: languageInputSchema,
    title: Type.String({ minLength: 1, maxLength: 500 }),
  },
  { additionalProperties: false },
);

export const addArticleSectionLanguageInputSchema = Type.Object(
  { id: uuidInputSchema, language: languageInputSchema },
  { additionalProperties: false },
);

export const removeArticleSectionLanguageInputSchema = Type.Object(
  { id: uuidInputSchema, language: languageInputSchema, confirmLanguage: languageInputSchema },
  { additionalProperties: false },
);

export const deleteArticleSectionInputSchema = Type.Object(
  {
    id: uuidInputSchema,
    language: languageInputSchema,
    confirmTitle: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export const getArticleInputSchema = Type.Object(
  { id: uuidInputSchema, language: languageInputSchema },
  { additionalProperties: false },
);

export const createArticleInputSchema = Type.Object(
  {
    idempotencyKey: idempotencyKeyInputSchema,
    language: languageInputSchema,
    sectionId: uuidInputSchema,
  },
  { additionalProperties: false },
);

export const updateArticleInputSchema = Type.Object(
  {
    id: uuidInputSchema,
    language: languageInputSchema,
    title: Type.Optional(Type.String({ minLength: 1, maxLength: 500 })),
    summary: Type.Optional(Type.String({ maxLength: 20000 })),
    content: Type.Optional(Type.String({ maxLength: 200000 })),
  },
  { additionalProperties: false },
);

export const addArticleLanguageInputSchema = Type.Object(
  { id: uuidInputSchema, language: languageInputSchema },
  { additionalProperties: false },
);

export const removeArticleLanguageInputSchema = Type.Object(
  { id: uuidInputSchema, language: languageInputSchema, confirmLanguage: languageInputSchema },
  { additionalProperties: false },
);

export const deleteArticleInputSchema = Type.Object(
  {
    id: uuidInputSchema,
    language: languageInputSchema,
    confirmTitle: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export const listNewsInputSchema = Type.Object(
  { language: languageInputSchema, page: Type.Optional(Type.Integer({ minimum: 1 })) },
  { additionalProperties: false },
);

export const getNewsInputSchema = Type.Object(
  { id: uuidInputSchema, language: languageInputSchema },
  { additionalProperties: false },
);

export const createNewsInputSchema = Type.Object(
  { language: languageInputSchema, idempotencyKey: idempotencyKeyInputSchema },
  { additionalProperties: false },
);

export const updateNewsInputSchema = Type.Object(
  {
    id: uuidInputSchema,
    language: languageInputSchema,
    expectedRevision: revisionInputSchema,
    title: Type.Optional(Type.String({ minLength: 1, maxLength: 500 })),
    summary: Type.Optional(Type.String({ maxLength: 20000 })),
    content: Type.Optional(Type.String({ maxLength: 200000 })),
  },
  { additionalProperties: false },
);

export const addNewsLanguageInputSchema = Type.Object(
  { id: uuidInputSchema, language: languageInputSchema },
  { additionalProperties: false },
);

export const removeNewsLanguageInputSchema = Type.Object(
  { id: uuidInputSchema, language: languageInputSchema, confirmLanguage: languageInputSchema },
  { additionalProperties: false },
);

export const deleteNewsInputSchema = Type.Object(
  {
    id: uuidInputSchema,
    language: languageInputSchema,
    confirmTitle: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export const listDevelopmentPathsInputSchema = Type.Object(
  {
    language: languageInputSchema,
    page: Type.Optional(Type.Integer({ minimum: 1 })),
    query: Type.Optional(Type.String({ maxLength: 200 })),
  },
  { additionalProperties: false },
);

export const getDevelopmentPathInputSchema = Type.Object(
  { pathId: uuidInputSchema, language: languageInputSchema },
  { additionalProperties: false },
);

export const createDevelopmentPathInputSchema = Type.Object(
  {
    idempotencyKey: idempotencyKeyInputSchema,
    language: languageInputSchema,
    title: Type.String({ minLength: 1, maxLength: 500 }),
    description: Type.String({ maxLength: 20000 }),
  },
  { additionalProperties: false },
);

export const updateDevelopmentPathInputSchema = Type.Object(
  {
    pathId: uuidInputSchema,
    language: languageInputSchema,
    title: Type.Optional(Type.String({ minLength: 1, maxLength: 500 })),
    description: Type.Optional(Type.String({ maxLength: 20000 })),
    sequenceEnabled: Type.Optional(Type.Boolean()),
    includesCertificate: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const setDevelopmentPathStatusInputSchema = Type.Object(
  {
    pathId: uuidInputSchema,
    language: languageInputSchema,
    status: Type.Enum(LEARNING_PATH_STATUSES),
    expectedRevision: Type.String({ minLength: 1 }),
    confirmPublish: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const addDevelopmentPathLanguageInputSchema = Type.Object(
  { pathId: uuidInputSchema, language: languageInputSchema },
  { additionalProperties: false },
);

export const listDevelopmentPathCoursesInputSchema = Type.Object(
  { pathId: uuidInputSchema, language: languageInputSchema },
  { additionalProperties: false },
);

export const addCoursesToDevelopmentPathInputSchema = Type.Object(
  {
    idempotencyKey: idempotencyKeyInputSchema,
    pathId: uuidInputSchema,
    courseIds: Type.Array(uuidInputSchema, { minItems: 1, maxItems: 50, uniqueItems: true }),
  },
  { additionalProperties: false },
);

export const reorderDevelopmentPathCoursesInputSchema = Type.Object(
  {
    pathId: uuidInputSchema,
    courseIds: Type.Array(uuidInputSchema, { minItems: 1, maxItems: 100, uniqueItems: true }),
  },
  { additionalProperties: false },
);

export const removeCourseFromDevelopmentPathInputSchema = Type.Object(
  { pathId: uuidInputSchema, courseId: uuidInputSchema, confirmCourseId: uuidInputSchema },
  { additionalProperties: false },
);

export const deleteDevelopmentPathInputSchema = Type.Object(
  {
    pathId: uuidInputSchema,
    language: languageInputSchema,
    confirmTitle: Type.String({ minLength: 1 }),
    expectedRevision: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);
