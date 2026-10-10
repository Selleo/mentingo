import {
  AI_MENTOR_TTS_PRESET,
  AI_MENTOR_TYPE,
  AI_MENTOR_VOICE_MODE,
  orderCourseAuthoringOperations,
} from "@repo/shared";

import { FILL_IN_THE_BLANKS_BUTTON_CLASSNAME } from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/QuizLessonForm/components/constants";
import { LessonType } from "~/modules/Admin/EditCourse/EditCourse.types";

import { applyBlockReplacements } from "./contentDiff";
import { AUTHORING_OPERATION_TYPE } from "./curriculumReview.constants";

import type { ReviewLessonNode } from "./curriculumReview.types";
import type { AiMentorTTSPreset, AiMentorVoiceMode } from "@repo/shared";
import type { AiJudgeConfigurationDraft } from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/AiMentorLessonForm/AiJudge/aiJudgeConfiguration.types";
import type { AiMentorConfigurationDraft } from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/AiMentorLessonForm/AiMentorConfiguration/aiMentorConfiguration.types";
import type { AiMentorLessonReviewPreview } from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/AiMentorLessonForm/aiMentorLessonReview.types";
import type {
  Question,
  QuestionOption,
  QuestionType,
} from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/QuizLessonForm/QuizLessonForm.types";
import type { Lesson } from "~/modules/Admin/EditCourse/EditCourse.types";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown) => (typeof value === "string" ? value : "");
const numberOrUndefined = (value: unknown) => (typeof value === "number" ? value : undefined);
const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });

const nativeBlankQuestion = (value: Record<string, unknown>) => {
  const blanks = Array.isArray(value.blanks) ? value.blanks.filter(isObject) : [];
  const dragOptions = Array.isArray(value.dragAndDropOptions)
    ? value.dragAndDropOptions.filter(isObject)
    : [];
  const usedDragIds = new Set<string>();
  const options = blanks.map((blank, index) => {
    const blankId = text(blank.id);
    const answerSets = Array.isArray(blank.answerSets) ? blank.answerSets.filter(isObject) : [];
    const dragOption = dragOptions.find(
      (item) => text(item.targetBlankId) === blankId && !usedDragIds.has(text(item.id)),
    );
    if (dragOption) usedDragIds.add(text(dragOption.id));
    const answer = text(dragOption?.label) || text(answerSets[0]?.preferredAnswer);
    return option(blankId, answer, index + 1, { isCorrect: true });
  });
  dragOptions.forEach((item) => {
    const dragId = text(item.id);
    if (usedDragIds.has(dragId)) return;
    options.push(option(dragId, text(item.label), options.length + 1));
  });
  const prompt = text(value.prompt) || text(value.description);
  const description = prompt.replace(
    /<blank-answer-([0-9a-fA-F-]{36})>\s*<\/blank-answer-\1>/g,
    (_marker, blankId: string) => {
      const answer = options.find((item) => item.id === blankId)?.optionText ?? "";
      return `<button type="button" class="${FILL_IN_THE_BLANKS_BUTTON_CLASSNAME}" data-word="${escapeHtml(answer)}" data-option-id="${blankId}"><span>${escapeHtml(answer)}</span></button>`;
    },
  );
  return { description, options };
};

const WRITE_TYPES = new Set<string>([
  AUTHORING_OPERATION_TYPE.LESSON_CREATE,
  AUTHORING_OPERATION_TYPE.LESSON_UPDATE,
  AUTHORING_OPERATION_TYPE.COURSE_LESSON_CREATE,
  AUTHORING_OPERATION_TYPE.COURSE_LESSON_UPDATE,
]);

const option = (
  id: unknown,
  optionText: string,
  displayOrder: number,
  extra: Partial<QuestionOption> = {},
): QuestionOption => {
  const optionId = text(id) || `option-${displayOrder}`;
  return {
    id: optionId,
    sortableId: optionId,
    optionText,
    isCorrect: false,
    displayOrder,
    ...extra,
  };
};

/** Maps an authoring question payload to the quiz form's question shape. */
const toFormQuestion = (value: unknown, index: number): Question | null => {
  if (!isObject(value)) return null;
  const id = text(value.id) || `question-${index}`;
  const questionType = text(value.questionType) || text(value.type);
  const isBlankQuestion =
    questionType === "fill_in_the_blanks_text" || questionType === "fill_in_the_blanks_dnd";
  const blankQuestion = isBlankQuestion ? nativeBlankQuestion(value) : null;
  const options = [
    ...(blankQuestion?.options ?? []),
    ...(Array.isArray(value.options) ? value.options.filter(isObject) : []).map((item, order) =>
      option(item.id, text(item.label) || text(item.optionText), order + 1, {
        isCorrect: item.isCorrect === true,
      }),
    ),
    ...(Array.isArray(value.trueFalseStatements)
      ? value.trueFalseStatements.filter(isObject)
      : []
    ).map((item, order) =>
      option(item.id, text(item.statement), order + 1, { isCorrect: item.correctValue === true }),
    ),
    ...(Array.isArray(value.scaleOptions) ? value.scaleOptions.filter(isObject) : []).map(
      (item, order) =>
        option(item.id, text(item.label), order + 1, {
          scaleAnswer: numberOrUndefined(item.scaleValue),
        }),
    ),
  ];
  return {
    id,
    sortableId: id,
    type: questionType as QuestionType,
    title: text(value.title),
    description:
      blankQuestion?.description || text(value.prompt) || text(value.description) || undefined,
    photoS3Key: text(value.photoS3Key) || undefined,
    displayOrder: numberOrUndefined(value.displayOrder) ?? index + 1,
    options,
  };
};

/**
 * Builds the lesson the native editor forms should show for a review node: the proposed
 * version for new and edited lessons, and the live lesson otherwise. Returns null when the
 * proposal cannot be expressed in the native form.
 */
const proposedLessonContent = (node: ReviewLessonNode): Lesson | null => {
  const write = node.operations.find((operation) => WRITE_TYPES.has(operation.type));
  const base: Lesson = node.current ?? {
    id: node.id,
    title: node.title,
    type: node.lessonType as Lesson["type"],
    description: "",
    displayOrder: 0,
    updatedAt: "",
    chapterId: node.chapterId,
  };
  if (!write) return null;

  const payload = write?.payload ?? {};
  const type = (text(payload.lessonType) || base.type) as Lesson["type"];

  if (type === LessonType.CONTENT) {
    const description =
      typeof payload.description === "string"
        ? payload.description
        : text(payload.html) || base.description || "";
    return {
      ...base,
      type,
      title: node.title,
      description,
    };
  }

  if (type === LessonType.QUIZ && Array.isArray(payload.questions)) {
    return {
      ...base,
      type,
      title: node.title,
      thresholdScore: numberOrUndefined(payload.thresholdScore) ?? base.thresholdScore,
      attemptsLimit: numberOrUndefined(payload.attemptsLimit) ?? base.attemptsLimit,
      quizCooldownInHours:
        numberOrUndefined(payload.quizCooldownInHours) ?? base.quizCooldownInHours,
      questions: payload.questions
        .map(toFormQuestion)
        .filter((question): question is Question => question !== null),
    };
  }

  if (type === LessonType.AI_MENTOR && payload.lessonType === LessonType.AI_MENTOR) {
    const voiceMode = text(payload.voiceMode);
    const ttsPreset = text(payload.ttsPreset);
    return {
      ...base,
      type,
      title: node.title,
      description: typeof payload.description === "string" ? payload.description : base.description,
      aiMentor: {
        id: base.aiMentor?.id ?? node.id,
        lessonId: base.id,
        name: text(payload.name) || base.aiMentor?.name || "",
        voiceMode: (voiceMode ||
          base.aiMentor?.voiceMode ||
          AI_MENTOR_VOICE_MODE.PRESET) as AiMentorVoiceMode,
        ttsPreset: (ttsPreset ||
          base.aiMentor?.ttsPreset ||
          AI_MENTOR_TTS_PRESET.MALE) as AiMentorTTSPreset,
        customTtsReference:
          text(payload.customTtsReference) || base.aiMentor?.customTtsReference || null,
      },
    };
  }

  return null;
};

/** Cross-node dependencies are validated by the workspace; sort the lesson's local edges here. */
const orderedLessonOperations = (node: ReviewLessonNode) => {
  const ids = new Set(node.operations.map((operation) => operation.operationId));
  return orderCourseAuthoringOperations(
    node.operations.map((operation) => ({
      ...operation,
      dependencies: operation.dependencies.filter((id) => ids.has(id)),
    })),
  );
};

/** Project writes and patches sequentially, using the same dependency order as native Apply. */
export const proposedLesson = (node: ReviewLessonNode): Lesson | null => {
  let lesson: Lesson | null = node.current ? { ...node.current, title: node.title } : null;
  for (const operation of orderedLessonOperations(node)) {
    if (WRITE_TYPES.has(operation.type)) {
      lesson = proposedLessonContent({
        ...node,
        current: lesson,
        title: typeof operation.payload.title === "string" ? operation.payload.title : node.title,
        operations: [operation],
      });
    } else if (lesson && operation.type === AUTHORING_OPERATION_TYPE.LESSON_METADATA_UPDATE) {
      lesson = {
        ...lesson,
        ...(typeof operation.payload.title === "string" ? { title: operation.payload.title } : {}),
        ...(typeof operation.payload.description === "string"
          ? { description: operation.payload.description }
          : {}),
      };
    } else if (lesson && operation.type === AUTHORING_OPERATION_TYPE.LESSON_BLOCK_REPLACE) {
      lesson = {
        ...lesson,
        description: applyBlockReplacements(lesson.description, [
          { blockId: text(operation.payload.blockId), html: text(operation.payload.html) },
        ]),
      };
    }
  }
  return lesson;
};

/** Maps the proposed Mentor and judge configuration to the AI Mentor form's draft shapes. */
export const proposedMentorConfiguration = (
  node: ReviewLessonNode,
): Omit<AiMentorLessonReviewPreview, "isPersisted"> => {
  const payload = orderedLessonOperations(node)
    .reverse()
    .find((operation) => WRITE_TYPES.has(operation.type))?.payload;
  if (!payload || payload.lessonType !== LessonType.AI_MENTOR) return {};
  const configurationType = text(payload.configurationType);
  const aiMentorConfiguration =
    isObject(payload.configuration) &&
    (configurationType === AI_MENTOR_TYPE.TEACHER || configurationType === AI_MENTOR_TYPE.ROLEPLAY)
      ? ({ ...payload.configuration, type: configurationType } as AiMentorConfigurationDraft)
      : undefined;
  const judge = isObject(payload.judgeConfiguration) ? payload.judgeConfiguration : null;
  const aiJudgeConfiguration: AiJudgeConfigurationDraft | undefined = judge
    ? {
        taskGoal: text(judge.taskGoal),
        passingThresholdPercent: numberOrUndefined(judge.passingThresholdPercent) ?? 0,
        criteria: (Array.isArray(judge.criteria) ? judge.criteria.filter(isObject) : []).map(
          (criterion) => ({
            title: text(criterion.title),
            expectedBehavior: text(criterion.expectedBehavior),
            maxScore: numberOrUndefined(criterion.maxScore) ?? 0,
            scoreGuidance: (Array.isArray(criterion.scoreGuidance)
              ? criterion.scoreGuidance.filter(isObject)
              : []
            ).map((guidance) => ({
              score: numberOrUndefined(guidance.score) ?? 0,
              description: text(guidance.description),
              example: text(guidance.example) || undefined,
            })),
          }),
        ),
        blockingErrors: (Array.isArray(judge.blockingErrors)
          ? judge.blockingErrors.filter(isObject)
          : []
        ).map((blockingError) => ({ description: text(blockingError.description) })),
      }
    : undefined;
  return { aiMentorConfiguration, aiJudgeConfiguration };
};
