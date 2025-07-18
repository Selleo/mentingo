import { QuestionType } from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/QuizLessonForm/QuizLessonForm.types";

import type { EvaluationQuizBody, GetLessonByIdResponse } from "~/api/generated-api";
import type { QuizForm } from "~/modules/Courses/Lesson/types";

type Questions = NonNullable<GetLessonByIdResponse["data"]["quizDetails"]>["questions"];

type GetUserAnswersResult = {
  singleAnswerQuestions: Record<string, Record<string, string>> | Record<string, string>;
  multiAnswerQuestions: Record<string, Record<string, string>> | Record<string, string>;
  trueOrFalseQuestions: Record<string, Record<string, string>> | Record<string, string>;
  photoQuestionSingleChoice: Record<string, Record<string, string>> | Record<string, string>;
  photoQuestionMultipleChoice: Record<string, Record<string, string>> | Record<string, string>;
  fillInTheBlanksText: Record<string, Record<string, string>> | Record<string, string>;
  fillInTheBlanksDnd: Record<string, Record<string, string>> | Record<string, string>;
  matchWords: Record<string, Record<string, string>> | Record<string, string>;
  scaleQuestions: Record<string, Record<string, string>> | Record<string, string>;
  briefResponses: Record<string, string> | Record<string, Record<string, string>>;
  detailedResponses: Record<string, string> | Record<string, Record<string, string>>;
};

export const getUserAnswers = (questions: Questions): GetUserAnswersResult => {
  const groupedQuestions = groupQuestionsByType(questions);

  return {
    singleAnswerQuestions: prepareAnswers(groupedQuestions.single_choice, "options"),
    multiAnswerQuestions: prepareAnswers(groupedQuestions.multiple_choice, "options"),
    trueOrFalseQuestions: prepareAnswers(groupedQuestions.true_or_false, "options"),
    photoQuestionSingleChoice: prepareAnswers(
      groupedQuestions.photo_question_single_choice,
      "options",
    ),
    photoQuestionMultipleChoice: prepareAnswers(
      groupedQuestions.photo_question_multiple_choice,
      "options",
    ),
    fillInTheBlanksText: prepareAnswers(groupedQuestions.fill_in_the_blanks_text, "options"),
    fillInTheBlanksDnd: prepareAnswers(groupedQuestions.fill_in_the_blanks_dnd, "options"),
    matchWords: prepareAnswers(groupedQuestions.match_words, "options"),
    scaleQuestions: prepareAnswers(groupedQuestions.scale_1_5, "options"),
    briefResponses: prepareAnswers(groupedQuestions.brief_response, "open"),
    detailedResponses: prepareAnswers(groupedQuestions.detailed_response, "open"),
  } as const;
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

const prepareAnswers = (
  questions: Questions,
  mode: "options" | "open",
): Record<string, string> | Record<string, Record<string, string>> => {
  return questions.reduce(
    (result, question) => {
      if (QuestionType.TRUE_OR_FALSE) {
        result[question.id] =
          question?.options?.reduce(
            (optionMap, option) => {
              optionMap[option.id ?? "0"] = option.isStudentAnswer ? `${option.id}` : "";
              return optionMap;
            },
            {} as Record<string, string>,
          ) || {};
      }

      if (question.type === QuestionType.FILL_IN_THE_BLANKS_TEXT) {
        result[question.id ?? ""] =
          question?.options?.reduce(
            (map, { studentAnswer }, index) => {
              map[`${index + 1}`] = studentAnswer ?? "";

              return map;
            },
            {} as Record<string, string>,
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
            {} as Record<string, string>,
          ) || {};

        return result;
      }

      if (mode === "options") {
        result[question.id ?? ""] =
          question?.options?.reduce(
            (optionMap, option) => {
              optionMap[option.id ?? "0"] = option.isStudentAnswer ? `${option.id}` : "";
              return optionMap;
            },
            {} as Record<string, string>,
          ) || {};
      }

      if (mode === "open") {
        const studentAnswer = question.options?.[0]?.studentAnswer || "";
        const isStudentAnswer = question.options?.[0]?.isStudentAnswer || false;

        result[question.id] = isStudentAnswer ? studentAnswer : "";
      }
      return result;
    },
    mode === "options"
      ? ({} as Record<string, Record<string, string>>)
      : ({} as Record<string, string>),
  );
};

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

export const leftAttemptsToDisplay = (
  attempts: number | null,
  attemptsLimit: number | null,
  canRetake: boolean,
  cooldownTimeLeft: number | null,
) => {
  if (attemptsLimit === null) return "";
  const leftAttempts = attemptsLimit - (attempts ?? 1);
  return `(${
    !canRetake && cooldownTimeLeft !== null
      ? 0
      : attemptsLimit !== null
        ? leftAttempts > 0
          ? leftAttempts
          : attemptsLimit === 1
            ? "0"
            : attemptsLimit
        : ""
  })`;
};
