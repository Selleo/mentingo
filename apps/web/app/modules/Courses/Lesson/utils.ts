import { t } from "i18next";
import { find, flatMap } from "lodash-es";

import { QuestionType } from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/QuizLessonForm/QuizLessonForm.types";
import { LESSON_PROGRESS_STATUSES, type QuizForm } from "~/modules/Courses/Lesson/types";

import type {
  GetCourseResponse,
  EvaluationQuizBody,
  GetLessonByIdResponse,
} from "~/api/generated-api";

type Questions = NonNullable<GetLessonByIdResponse["data"]["quizDetails"]>["questions"];

type AnswersMap = Record<string, Record<string, string | null>>;
type OpenAnswersMap = Record<string, string>;

export const getUserAnswers = (questions: Questions): QuizForm => {
  const groupedQuestions = groupQuestionsByType(questions);

  return {
    singleAnswerQuestions: prepareOptionAnswers(groupedQuestions.single_choice),
    multiAnswerQuestions: prepareOptionAnswers(groupedQuestions.multiple_choice),
    trueOrFalseQuestions: prepareOptionAnswers(groupedQuestions.true_or_false),
    photoQuestionSingleChoice: prepareOptionAnswers(groupedQuestions.photo_question_single_choice),
    photoQuestionMultipleChoice: prepareOptionAnswers(
      groupedQuestions.photo_question_multiple_choice,
    ),
    fillInTheBlanksText: prepareOptionAnswers(groupedQuestions.fill_in_the_blanks_text),
    fillInTheBlanksDnd: prepareOptionAnswers(groupedQuestions.fill_in_the_blanks_dnd),
    briefResponses: prepareOpenAnswers(groupedQuestions.brief_response),
    detailedResponses: prepareOpenAnswers(groupedQuestions.detailed_response),
  } as const;
};

export const getEmptyQuizAnswers = (questions: Questions): QuizForm => {
  const groupedQuestions = groupQuestionsByType(questions);

  return {
    singleAnswerQuestions: prepareEmptyOptionAnswers(groupedQuestions.single_choice),
    multiAnswerQuestions: prepareEmptyOptionAnswers(groupedQuestions.multiple_choice),
    trueOrFalseQuestions: prepareEmptyOptionAnswers(groupedQuestions.true_or_false),
    photoQuestionSingleChoice: prepareEmptyOptionAnswers(
      groupedQuestions.photo_question_single_choice,
    ),
    photoQuestionMultipleChoice: prepareEmptyOptionAnswers(
      groupedQuestions.photo_question_multiple_choice,
    ),
    fillInTheBlanksText: prepareEmptyOptionAnswers(groupedQuestions.fill_in_the_blanks_text),
    fillInTheBlanksDnd: prepareEmptyOptionAnswers(groupedQuestions.fill_in_the_blanks_dnd),
    briefResponses: prepareEmptyOpenAnswers(groupedQuestions.brief_response),
    detailedResponses: prepareEmptyOpenAnswers(groupedQuestions.detailed_response),
  };
};

const groupQuestionsByType = (questions: Questions) => {
  return {
    single_choice: questions.filter(({ type }) => type === "single_choice"),
    multiple_choice: questions.filter(({ type }) => type === "multiple_choice"),
    true_or_false: questions.filter(({ type }) => type === "true_or_false"),
    photo_question_single_choice: questions.filter(
      ({ type }) => type === "photo_question_single_choice",
    ),
    photo_question_multiple_choice: questions.filter(
      ({ type }) => type === "photo_question_multiple_choice",
    ),
    fill_in_the_blanks_text: questions.filter(({ type }) => type === "fill_in_the_blanks_text"),
    fill_in_the_blanks_dnd: questions.filter(({ type }) => type === "fill_in_the_blanks_dnd"),
    match_words: questions.filter(({ type }) => type === "match_words"),
    scale_1_5: questions.filter(({ type }) => type === "scale_1_5"),
    brief_response: questions.filter(({ type }) => type === "brief_response"),
    detailed_response: questions.filter(({ type }) => type === "detailed_response"),
  };
};

function prepareEmptyOptionAnswers(questions: Questions): AnswersMap {
  return questions.reduce((result, question) => {
    if (question.type === QuestionType.TRUE_OR_FALSE) {
      result[question.id] =
        question?.options?.reduce(
          (optionMap, option) => {
            if (option.id) {
              optionMap[option.id] = null;
            }
            return optionMap;
          },
          {} as Record<string, string | null>,
        ) || {};

      return result;
    }

    if (question.type === QuestionType.FILL_IN_THE_BLANKS_TEXT) {
      result[question.id ?? ""] =
        question?.options?.reduce(
          (map, _option, index) => {
            map[`${index + 1}`] = null;
            return map;
          },
          {} as Record<string, string | null>,
        ) || {};

      return result;
    }

    if (question.type === QuestionType.FILL_IN_THE_BLANKS_DND) {
      const maxAnswersAmount = question.description?.match(/\[word]/g)?.length ?? 0;
      const emptyMap: Record<string, string | null> = {};
      for (let index = 1; index <= maxAnswersAmount; index += 1) {
        emptyMap[`${index}`] = null;
      }
      result[question.id ?? ""] = emptyMap;

      return result;
    }

    result[question.id ?? ""] =
      question?.options?.reduce(
        (optionMap, option) => {
          if (option.id) {
            optionMap[option.id] = null;
          }
          return optionMap;
        },
        {} as Record<string, string | null>,
      ) || {};

    return result;
  }, {} as AnswersMap);
}

function prepareEmptyOpenAnswers(questions: Questions): OpenAnswersMap {
  return questions.reduce((result, question) => {
    result[question.id] = "";
    return result;
  }, {} as OpenAnswersMap);
}

function prepareOptionAnswers(questions: Questions): AnswersMap {
  return questions.reduce((result, question) => {
    if (question.type === QuestionType.TRUE_OR_FALSE) {
      result[question.id] =
        question?.options?.reduce(
          (optionMap, option) => {
            optionMap[option.id ?? "0"] = option.studentAnswer ?? "";
            return optionMap;
          },
          {} as Record<string, string | null>,
        ) || {};

      return result;
    }

    if (question.type === QuestionType.FILL_IN_THE_BLANKS_TEXT) {
      result[question.id ?? ""] =
        question?.options?.reduce(
          (map, { studentAnswer }, index) => {
            map[`${index + 1}`] = studentAnswer ?? "";

            return map;
          },
          {} as Record<string, string | null>,
        ) || {};

      return result;
    }

    if (question.type === QuestionType.FILL_IN_THE_BLANKS_DND) {
      const maxAnswersAmount = question.description?.match(/\[word]/g)?.length ?? 0;
      result[question.id ?? ""] =
        question?.options?.reduce(
          (optionMap, option, index) => {
            if (index < maxAnswersAmount) {
              optionMap[`${index + 1}`] = option.isStudentAnswer ? `${option.id}` : "";
            }

            return optionMap;
          },
          {} as Record<string, string | null>,
        ) || {};

      return result;
    }

    result[question.id ?? ""] =
      question?.options?.reduce(
        (optionMap, option) => {
          optionMap[option.id ?? "0"] = option.isStudentAnswer ? `${option.id}` : "";
          return optionMap;
        },
        {} as Record<string, string | null>,
      ) || {};

    return result;
  }, {} as AnswersMap);
}

function prepareOpenAnswers(questions: Questions): OpenAnswersMap {
  return questions.reduce((result, question) => {
    const studentAnswer = question.options?.[0]?.studentAnswer || "";
    const isStudentAnswer = question.options?.[0]?.isStudentAnswer || false;

    result[question.id] = isStudentAnswer ? studentAnswer : "";
    return result;
  }, {} as OpenAnswersMap);
}

export const parseQuizFormData = (input: QuizForm) => {
  const result: EvaluationQuizBody["questionsAnswers"] = [];

  const processSingleAnswerQuestions = (
    questionMap: Record<string, Record<string, string | null>>,
  ) => {
    for (const questionId in questionMap) {
      const answers = questionMap[questionId];
      const answerArray = Object.entries(answers)
        .filter(([_, value]) => value)
        .map(([answerId]) => ({ answerId }));

      if (answerArray.length > 0) {
        result.push({
          questionId,
          answers: answerArray,
        });
      }
    }
  };

  const processFillInTheBlanks = (questionMap: Record<string, Record<string, string | null>>) => {
    for (const questionId in questionMap) {
      const answers = questionMap[questionId];
      const answerArray = Object.entries(answers)
        .filter(([_, value]) => value)
        .map(([_, value]) => ({ value, answerId: "" }));

      if (answerArray.length > 0) {
        result.push({
          questionId,
          answers: answerArray,
        });
      }
    }
  };

  const processBooleanQuestions = (questionMap: Record<string, Record<string, string | null>>) => {
    for (const questionId in questionMap) {
      const answers = questionMap[questionId];
      const answerArray = Object.entries(answers)
        .filter(([_, value]) => value === "true" || value === "false")
        .map(([answerId, value]) => ({ answerId, value }));

      if (answerArray.length > 0) {
        result.push({
          questionId,
          answers: answerArray,
        });
      }
    }
  };

  const processSimpleResponses = (questionMap: Record<string, string>) => {
    for (const questionId in questionMap) {
      result.push({
        questionId,
        answers: [
          {
            answerId: questionId,
            value: questionMap[questionId],
          },
        ],
      });
    }
  };

  processSimpleResponses(input.detailedResponses);
  processSimpleResponses(input.briefResponses);
  processSingleAnswerQuestions(input.singleAnswerQuestions);
  processSingleAnswerQuestions(input.photoQuestionSingleChoice);
  processSingleAnswerQuestions(input.multiAnswerQuestions);
  processFillInTheBlanks(input.fillInTheBlanksText);
  processFillInTheBlanks(input.fillInTheBlanksDnd);
  processSingleAnswerQuestions(input.photoQuestionMultipleChoice);
  processBooleanQuestions(input.trueOrFalseQuestions);

  return result;
};

export function getCurrentChapterId(
  course: GetCourseResponse["data"],
  lessonId: string,
): string | undefined {
  return (
    course.chapters.find((chapter) => chapter.lessons.some((lesson) => lesson.id === lessonId))
      ?.id ?? course.chapters[0]?.id
  );
}

export const findFirstNotStartedLessonId = (course: GetCourseResponse["data"]) => {
  const allLessons = flatMap(course.chapters, (chapter) => chapter.lessons);
  return find(allLessons, (lesson) => lesson.status === LESSON_PROGRESS_STATUSES.NOT_STARTED)?.id;
};

export const findFirstInProgressLessonId = (course: GetCourseResponse["data"]) => {
  const allLessons = flatMap(course.chapters, (chapter) => chapter.lessons);
  return find(allLessons, (lesson) => lesson.status === LESSON_PROGRESS_STATUSES.IN_PROGRESS)?.id;
};

export const isNextBlocked = (
  currentLessonIndex: number,
  totalLessons: number,
  isNextChapterFreemium: boolean,
  isEnrolled: boolean,
  cannotEnterNextLesson: boolean,
) => {
  const isLastLessonInChapter = currentLessonIndex === totalLessons - 1;
  const isNextChapterPaid = !isNextChapterFreemium;
  const isUserNotEnrolled = !isEnrolled;
  const isNextChapterAvailable = isLastLessonInChapter && isNextChapterPaid && isUserNotEnrolled;

  return isNextChapterAvailable || cannotEnterNextLesson;
};

export const isPreviousBlocked = (
  currentLessonIndex: number,
  isPrevChapterFreemium: boolean,
  isEnrolled: boolean,
) => {
  const isFirstLessonInChapter = currentLessonIndex === 0;
  const isPrevChapterPaid = !isPrevChapterFreemium;
  const isUserNotEnrolled = !isEnrolled;

  return isFirstLessonInChapter && isPrevChapterPaid && isUserNotEnrolled;
};

export const leftAttemptsToDisplay = (
  attempts: number | null,
  attemptsLimit: number | null,
  canRetake: boolean,
  cooldownTimeLeft: number | null,
): string => {
  if (attemptsLimit === null) return "";

  const leftAttempts = attemptsLimit - ((attempts ?? 1) % attemptsLimit);

  if (!canRetake && cooldownTimeLeft !== null) return "(0)";
  if (attemptsLimit === 1) return "(0)";
  if (leftAttempts > 0) return `(${leftAttempts})`;
  return `(${attemptsLimit})`;
};

export const getQuizTooltipText = (
  isUserSubmittedAnswer: boolean,
  canRetake: boolean,
  hoursLeft: number | null,
  quizCooldownInHours: number | null,
): string => {
  if (isUserSubmittedAnswer && !canRetake && hoursLeft !== null) {
    return t("studentLessonView.tooltip.retakeAvailableIn", { time: hoursLeft });
  }

  if (quizCooldownInHours !== null && quizCooldownInHours !== 0) {
    return t("studentLessonView.tooltip.cooldown", { time: quizCooldownInHours });
  }

  return t("studentLessonView.tooltip.noCooldown");
};
