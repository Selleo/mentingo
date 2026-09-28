import { type Static, Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import { nativeArchiveLiveTrainingLessonsSchema } from "./native-archive-live-training.schema";
import {
  nativeArchiveLanguageSchema,
  nativeArchiveLocalizedTextSchema,
} from "./native-archive-localization.schema";

const nullableStringSchema = Type.Union([Type.String(), Type.Null()]);
const jsonObjectSchema = Type.Record(Type.String(), Type.Unknown());

const courseSchema = Type.Object(
  {
    id: UUIDSchema,
    title: nativeArchiveLocalizedTextSchema,
    description: nativeArchiveLocalizedTextSchema,
    authorMetadata: Type.Optional(
      Type.Union([
        Type.Object(
          { profilePictureReference: Type.Optional(nullableStringSchema) },
          { additionalProperties: true },
        ),
        Type.Null(),
      ]),
    ),
    thumbnailS3Key: Type.Optional(nullableStringSchema),
    settings: Type.Object(
      { certificateSignature: Type.Optional(nullableStringSchema) },
      { additionalProperties: true },
    ),
    baseLanguage: nativeArchiveLanguageSchema,
    availableLocales: Type.Array(nativeArchiveLanguageSchema),
  },
  { additionalProperties: true },
);

const categorySchema = Type.Object(
  {
    id: UUIDSchema,
    title: nativeArchiveLocalizedTextSchema,
    baseLanguage: nativeArchiveLanguageSchema,
    availableLocales: Type.Array(nativeArchiveLanguageSchema),
  },
  { additionalProperties: true },
);

const chapterSchema = Type.Object({ id: UUIDSchema }, { additionalProperties: true });
const lessonSchema = Type.Object(
  {
    id: UUIDSchema,
    chapterId: UUIDSchema,
    fileS3Key: Type.Optional(nullableStringSchema),
  },
  { additionalProperties: true },
);
const resourceSchema = Type.Object(
  {
    id: UUIDSchema,
    title: nativeArchiveLocalizedTextSchema,
    description: nativeArchiveLocalizedTextSchema,
    reference: Type.String(),
    contentType: Type.String(),
    metadata: Type.Optional(Type.Union([jsonObjectSchema, Type.Null()])),
  },
  { additionalProperties: true },
);
const resourcePairSchema = Type.Object(
  {
    resource: resourceSchema,
    relation: Type.Optional(Type.Object({}, { additionalProperties: true })),
  },
  { additionalProperties: true },
);
const openTextSettingsSchema = Type.Object(
  { questionId: UUIDSchema },
  { additionalProperties: true },
);
const rowSchema = Type.Object(
  {
    id: UUIDSchema,
    courseId: Type.Optional(UUIDSchema),
    chapterId: Type.Optional(UUIDSchema),
    lessonId: Type.Optional(UUIDSchema),
    questionId: Type.Optional(UUIDSchema),
    assessmentId: Type.Optional(UUIDSchema),
    blankId: Type.Optional(UUIDSchema),
    resourceId: Type.Optional(UUIDSchema),
    documentId: Type.Optional(UUIDSchema),
  },
  { additionalProperties: true },
);
const questionSchema = Type.Intersect([
  rowSchema,
  Type.Object({ photoS3Key: Type.Optional(nullableStringSchema) }),
]);
const aiMentorSchema = Type.Intersect([
  rowSchema,
  Type.Object({ avatarReference: Type.Optional(nullableStringSchema) }),
]);
const scormPackageSchema = Type.Intersect([
  rowSchema,
  Type.Object({
    originalFileReference: Type.String(),
    extractedFilesReference: Type.String(),
  }),
]);

export const nativeArchiveCourseLanguageSchema = Type.Object({
  course: Type.Object({
    baseLanguage: nativeArchiveLanguageSchema,
    availableLocales: Type.Array(nativeArchiveLanguageSchema),
  }),
});

export const nativeArchiveCourseSnapshotSchema = Type.Object(
  {
    course: courseSchema,
    category: categorySchema,
    categoryBaseTitle: Type.String(),
    chapters: Type.Array(chapterSchema),
    lessons: Type.Array(lessonSchema),
    questions: Type.Array(questionSchema),
    options: Type.Array(rowSchema),
    assessmentQuestionBlanks: Type.Array(rowSchema),
    assessmentQuestionBlankAnswerSets: Type.Array(rowSchema),
    assessmentQuestionDragAndDropOptions: Type.Array(rowSchema),
    assessmentQuestionScaleOptions: Type.Array(rowSchema),
    assessmentQuestionTrueFalseStatements: Type.Array(rowSchema),
    questionResources: Type.Array(resourcePairSchema),
    assessmentQuestionOpenTextSettings: Type.Array(openTextSettingsSchema),
    assessments: Type.Array(rowSchema),
    aiMentors: Type.Array(aiMentorSchema),
    aiMentorConfigurations: Type.Array(rowSchema),
    aiMentorTeacherConfigurations: Type.Array(rowSchema),
    aiMentorRoleplayConfigurations: Type.Array(rowSchema),
    aiJudgeConfigurations: Type.Array(rowSchema),
    aiJudgeCriteria: Type.Array(rowSchema),
    aiJudgeScoreGuidance: Type.Array(rowSchema),
    aiJudgeBlockingErrors: Type.Array(rowSchema),
    aiMentorDocumentLinks: Type.Array(rowSchema),
    aiMentorDocuments: Type.Array(rowSchema),
    aiMentorDocChunks: Type.Array(rowSchema),
    scormPackages: Type.Array(scormPackageSchema),
    scormScos: Type.Array(rowSchema),
    lessonContentResources: Type.Array(resourceSchema),
    lessonResources: Type.Array(resourcePairSchema),
    courseResources: Type.Array(resourcePairSchema),
    liveTrainingLessons: Type.Optional(nativeArchiveLiveTrainingLessonsSchema),
  },
  { additionalProperties: true },
);

export type NativeArchiveCourseSnapshot = Static<typeof nativeArchiveCourseSnapshotSchema>;
