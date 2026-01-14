import { AI_MENTOR_TYPE, SUPPORTED_LANGUAGES } from "@repo/shared";
import { Type } from "@sinclair/typebox";

import { THREAD_STATUS } from "src/ai/utils/ai.type";
import { UUIDSchema } from "src/common";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";
import { QUESTION_TYPE } from "src/questions/schema/question.types";
import { PROGRESS_STATUSES } from "src/utils/types/progress.type";

import { LESSON_TYPES } from "./lesson.type";

import type { Static } from "@sinclair/typebox";

export const adminOptionSchema = Type.Object({
  id: Type.Optional(UUIDSchema),
  optionText: Type.String({ maxLength: 250 }),
  displayOrder: Type.Union([Type.Number(), Type.Null()]),
  isStudentAnswer: Type.Optional(Type.Union([Type.Boolean(), Type.Null()])),
  isCorrect: Type.Boolean(),
  questionId: Type.Optional(UUIDSchema),
  matchedWord: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  scaleAnswer: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  language: Type.Optional(supportedLanguagesSchema),
});

export const adminQuestionSchema = Type.Object({
  id: Type.Optional(UUIDSchema),
  type: Type.Enum(QUESTION_TYPE),
  description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  title: Type.String(),
  displayOrder: Type.Optional(Type.Number()),
  solutionExplanation: Type.Optional(Type.String()),
  photoS3Key: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  options: Type.Optional(Type.Array(adminOptionSchema)),
  language: Type.Optional(supportedLanguagesSchema),
});

export const optionSchema = Type.Object({
  id: UUIDSchema,
  optionText: Type.Union([Type.String({ maxLength: 250 }), Type.Null()]),
  displayOrder: Type.Union([Type.Number(), Type.Null()]),
  isStudentAnswer: Type.Union([Type.Boolean(), Type.Null()]),
  studentAnswer: Type.Union([Type.String(), Type.Null()]),
  isCorrect: Type.Union([Type.Boolean(), Type.Null()]),
  questionId: Type.Optional(UUIDSchema),
});

export const questionSchema = Type.Object({
  ...adminQuestionSchema.properties,
  id: UUIDSchema,
  solutionExplanation: Type.Union([Type.String(), Type.Null()]),
  options: Type.Optional(Type.Array(optionSchema)),
  passQuestion: Type.Union([Type.Boolean(), Type.Null()]),
});

const lessonQuizSchema = Type.Object({
  id: UUIDSchema,
  title: Type.String(),
  type: Type.String(),
  displayOrder: Type.Number(),
  description: Type.Optional(Type.String()),
  solutionExplanation: Type.Optional(Type.String()),
  fileS3Key: Type.Optional(Type.String()),
  fileType: Type.Optional(Type.String()),
  thresholdScore: Type.Number(),
  attemptsLimit: Type.Union([Type.Number(), Type.Null()]),
  quizCooldownInHours: Type.Union([Type.Number(), Type.Null()]),
  questions: Type.Optional(Type.Array(adminQuestionSchema)),
});

export const aiMentorLessonSchema = Type.Object({
  id: UUIDSchema,
  lessonId: UUIDSchema,
  aiMentorInstructions: Type.String(),
  completionConditions: Type.String(),
  type: Type.Enum(AI_MENTOR_TYPE),
  avatarReference: Type.Union([Type.String(), Type.Null()]),
});

export const lessonResourceSchema = Type.Object({
  id: UUIDSchema,
  fileUrl: Type.String(),
  contentType: Type.String(),
  title: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  fileName: Type.Optional(Type.String()),
  allowFullscreen: Type.Optional(Type.Boolean()),
});

export const adminLessonSchema = Type.Object({
  id: UUIDSchema,
  type: Type.Enum(LESSON_TYPES),
  displayOrder: Type.Number(),
  title: Type.String(),
  description: Type.String(),
  thresholdScore: Type.Number(),
  attemptsLimit: Type.Union([Type.Number(), Type.Null()]),
  quizCooldownInHours: Type.Union([Type.Number(), Type.Null()]),
  fileS3Key: Type.Optional(Type.String()),
  fileType: Type.Optional(Type.String()),
  questions: Type.Optional(Type.Array(adminQuestionSchema)),
  lessonResources: Type.Optional(Type.Array(lessonResourceSchema)),
  aiMentor: Type.Union([aiMentorLessonSchema, Type.Null()]),
});

export const lessonSchema = Type.Object({
  id: UUIDSchema,
  title: Type.String(),
  type: Type.Enum(LESSON_TYPES),
  description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  displayOrder: Type.Number(),
  fileS3Key: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  avatarReferenceUrl: Type.Optional(Type.String()),
  fileType: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  questions: Type.Optional(Type.Array(adminQuestionSchema)),
  aiMentor: Type.Optional(Type.Union([aiMentorLessonSchema, Type.Null()])),
  updatedAt: Type.Optional(Type.String()),
});

export const createAiMentorLessonSchema = Type.Intersect([
  Type.Omit(lessonSchema, ["id", "displayOrder", "type"]),
  Type.Object({
    chapterId: UUIDSchema,
    displayOrder: Type.Optional(Type.Number()),
    aiMentorInstructions: Type.String(),
    completionConditions: Type.String(),
    type: Type.Enum(AI_MENTOR_TYPE),
    name: Type.Optional(Type.String()),
  }),
]);
export const updateAiMentorLessonSchema = Type.Intersect([
  Type.Omit(createAiMentorLessonSchema, ["chapterId", "displayOrder"]),
  Type.Object({
    language: supportedLanguagesSchema,
  }),
]);

export const createLessonSchema = Type.Intersect([
  Type.Omit(lessonSchema, ["id", "displayOrder"]),
  Type.Object({
    chapterId: UUIDSchema,
    displayOrder: Type.Optional(Type.Number()),
  }),
]);

export const createQuizLessonSchema = Type.Intersect([
  Type.Omit(lessonQuizSchema, ["id", "displayOrder"]),
  Type.Object({
    chapterId: UUIDSchema,
    displayOrder: Type.Optional(Type.Number()),
  }),
]);

export const questionDetails = Type.Object({
  questions: Type.Array(questionSchema),
  questionCount: Type.Number(),
  correctAnswerCount: Type.Union([Type.Number(), Type.Null()]),
  wrongAnswerCount: Type.Union([Type.Number(), Type.Null()]),
  score: Type.Union([Type.Number(), Type.Null()]),
});

export const lessonShowSchema = Type.Object({
  id: UUIDSchema,
  title: Type.String(),
  type: Type.Enum(LESSON_TYPES),
  description: Type.Union([Type.String(), Type.Null()]),
  fileType: Type.Union([Type.String(), Type.Null()]),
  fileUrl: Type.Union([Type.String(), Type.Null()]),
  quizDetails: Type.Optional(questionDetails),
  lessonCompleted: Type.Optional(Type.Boolean()),
  thresholdScore: Type.Union([Type.Number(), Type.Null()]),
  attemptsLimit: Type.Union([Type.Number(), Type.Null()]),
  quizCooldownInHours: Type.Union([Type.Number(), Type.Null()]),
  isQuizPassed: Type.Union([Type.Boolean(), Type.Null()]),
  attempts: Type.Union([Type.Number(), Type.Null()]),
  updatedAt: Type.Union([Type.String(), Type.Null()]),
  displayOrder: Type.Number(),
  isExternal: Type.Optional(Type.Boolean()),
  nextLessonId: Type.Union([UUIDSchema, Type.Null()]),
  userLanguage: Type.Optional(Type.Enum(SUPPORTED_LANGUAGES)),
  status: Type.Optional(Type.Enum(THREAD_STATUS)),
  threadId: Type.Optional(UUIDSchema),
  lessonResources: Type.Optional(Type.Array(lessonResourceSchema)),
  hasOnlyVideo: Type.Optional(Type.Boolean()),
  hasVideo: Type.Optional(Type.Boolean()),
  isQuizFeedbackRedacted: Type.Optional(Type.Boolean()),
  aiMentorDetails: Type.Optional(
    Type.Union([
      Type.Object({
        minScore: Type.Union([Type.Number(), Type.Null()]),
        maxScore: Type.Union([Type.Number(), Type.Null()]),
        score: Type.Union([Type.Number(), Type.Null()]),
        percentage: Type.Union([Type.Number(), Type.Null()]),
        requiredScore: Type.Union([Type.Number(), Type.Null()]),
      }),
      Type.Null(),
    ]),
  ),
  aiMentor: Type.Optional(
    Type.Union([
      Type.Object({
        name: Type.Union([Type.String()]),
        avatarReferenceUrl: Type.Optional(Type.String()),
      }),
      Type.Null(),
    ]),
  ),
});

export const updateLessonSchema = Type.Intersect([
  Type.Partial(createLessonSchema),
  Type.Object({
    language: supportedLanguagesSchema,
  }),
]);

export const updateQuizLessonSchema = Type.Intersect([
  Type.Partial(createQuizLessonSchema),
  Type.Object({
    language: supportedLanguagesSchema,
  }),
]);

export const lessonForChapterSchema = Type.Array(
  Type.Object({
    id: UUIDSchema,
    title: Type.String(),
    type: Type.Enum(LESSON_TYPES),
    displayOrder: Type.Number(),
    status: Type.Enum(PROGRESS_STATUSES),
    quizQuestionCount: Type.Union([Type.Number(), Type.Null()]),
    isExternal: Type.Optional(Type.Boolean()),
    lessonResources: Type.Optional(Type.Array(lessonResourceSchema)),
  }),
);

export const createLessonResourcesBody = Type.Object({});

export const onlyAnswerIdSAnswerSchema = Type.Object({
  answerId: UUIDSchema,
});

export const onlyValueAnswerSchema = Type.Object({
  value: Type.String(),
});

export const fullAnswerSchema = Type.Object({
  answerId: UUIDSchema,
  value: Type.String(),
});

export const studentQuestionAnswersSchema = Type.Object({
  questionId: UUIDSchema,
  answers: Type.Array(
    Type.Union([onlyAnswerIdSAnswerSchema, onlyValueAnswerSchema, fullAnswerSchema]),
  ),
});

export const answerQuestionsForLessonBody = Type.Object({
  lessonId: UUIDSchema,
  questionsAnswers: Type.Array(studentQuestionAnswersSchema),
  language: Type.Enum(SUPPORTED_LANGUAGES),
});

export const nextLessonSchema = Type.Union([
  Type.Object({
    courseId: UUIDSchema,
    courseTitle: Type.String(),
    courseDescription: Type.String(),
    courseThumbnail: Type.String(),
    lessonId: UUIDSchema,
    chapterTitle: Type.String(),
    chapterProgress: Type.Enum(PROGRESS_STATUSES),
    completedLessonCount: Type.Number(),
    lessonCount: Type.Number(),
    chapterDisplayOrder: Type.Number(),
  }),
  Type.Null(),
]);

const lessonResourceInputSchema = Type.Object({
  id: Type.Optional(UUIDSchema),
  fileUrl: Type.String(),
  allowFullscreen: Type.Optional(Type.Boolean()),
});

export const createEmbedLessonSchema = Type.Object({
  title: Type.String(),
  type: Type.Enum(LESSON_TYPES),
  chapterId: UUIDSchema,
  resources: Type.Array(lessonResourceInputSchema),
});

export const updateEmbedLessonSchema = Type.Object({
  title: Type.String(),
  type: Type.Enum(LESSON_TYPES),
  resources: Type.Array(lessonResourceInputSchema),
  lessonId: UUIDSchema,
  language: supportedLanguagesSchema,
});

export const enrolledLessonsFiltersSchema = Type.Object({
  title: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  searchQuery: Type.Optional(Type.String()),
  lessonCompleted: Type.Optional(Type.Boolean()),
});

export const enrolledLessonSchema = Type.Object({
  id: UUIDSchema,
  title: Type.String(),
  type: Type.Enum(LESSON_TYPES),
  description: Type.Union([Type.String(), Type.Null()]),
  displayOrder: Type.Number(),
  lessonCompleted: Type.Boolean(),
  courseId: UUIDSchema,
  courseTitle: Type.String(),
  chapterId: UUIDSchema,
  chapterTitle: Type.String(),
  chapterDisplayOrder: Type.Number(),
});

export type AdminLessonWithContentSchema = Static<typeof adminLessonSchema>;
export type LessonForChapterSchema = Static<typeof lessonForChapterSchema>;
export type CreateLessonBody = Static<typeof createLessonSchema>;
export type UpdateLessonBody = Static<typeof updateLessonSchema>;
export type UpdateQuizLessonBody = Static<typeof updateQuizLessonSchema>;
export type CreateQuizLessonBody = Static<typeof createQuizLessonSchema>;
export type CreateAiMentorLessonBody = Static<typeof createAiMentorLessonSchema>;
export type OptionBody = Static<typeof optionSchema>;
export type AdminOptionBody = Static<typeof adminOptionSchema>;
export type AdminQuestionBody = Static<typeof adminQuestionSchema>;
export type QuestionBody = Static<typeof questionSchema>;
export type LessonShow = Static<typeof lessonShowSchema>;
export type LessonSchema = Static<typeof lessonSchema>;
export type AiMentorBody = Static<typeof aiMentorLessonSchema>;
export type UpdateAiMentorLessonBody = Static<typeof updateAiMentorLessonSchema>;
export type AnswerQuestionBody = Static<typeof answerQuestionsForLessonBody>;
export type QuestionDetails = Static<typeof questionDetails>;
export type NextLesson = Static<typeof nextLessonSchema>;
export type StudentQuestionAnswer = Static<typeof studentQuestionAnswersSchema>;
export type OnlyAnswerIdAsnwer = Static<typeof onlyAnswerIdSAnswerSchema>;
export type OnlyValueAnswer = Static<typeof onlyValueAnswerSchema>;
export type FullAnswer = Static<typeof fullAnswerSchema>;
export type LessonResource = Static<typeof lessonResourceSchema>;
export type CreateEmbedLessonBody = Static<typeof createEmbedLessonSchema>;
export type UpdateEmbedLessonBody = Static<typeof updateEmbedLessonSchema>;
export type EnrolledLessonsFilters = Static<typeof enrolledLessonsFiltersSchema>;
export type EnrolledLesson = Static<typeof enrolledLessonSchema>;
