import { expect } from "@playwright/test";
import { ASSESSMENT_SCORING_MODES } from "@repo/shared";

import { QuestionType } from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/QuizLessonForm/QuizLessonForm.types";

import { CURRICULUM_TEST_DATA } from "./curriculum.data";

import type { QuizQuestionInput } from "../../flows/curriculum/fill-quiz-question.flow";

export type QuizAuthoringCase = {
  name: string;
  questions: QuizQuestionInput[];
  /** Persisted questions in display order; options in display order. Partial match. */
  expected: Record<string, unknown>[];
};

export const QUIZ_AUTHORING_CASES: QuizAuthoringCase[] = [
  {
    name: "choice",
    questions: [
      {
        kind: "choice",
        type: QuestionType.SINGLE_CHOICE,
        title: "Single choice?",
        options: ["A", "B"],
        correctIndexes: [0],
      },
      {
        kind: "choice",
        type: QuestionType.MULTIPLE_CHOICE,
        title: "Multiple choice?",
        options: ["A", "B", "C"],
        correctIndexes: [0, 2],
      },
      {
        kind: "choice",
        type: QuestionType.TRUE_OR_FALSE,
        title: "True or false?",
        options: ["Correct", "Incorrect"],
        correctIndexes: [0],
      },
    ],
    expected: [
      {
        type: QuestionType.SINGLE_CHOICE,
        title: "Single choice?",
        options: [
          { optionText: "A", isCorrect: true },
          { optionText: "B", isCorrect: false },
        ],
      },
      {
        type: QuestionType.MULTIPLE_CHOICE,
        title: "Multiple choice?",
        options: [
          { optionText: "A", isCorrect: true },
          { optionText: "B", isCorrect: false },
          { optionText: "C", isCorrect: true },
        ],
      },
      {
        type: QuestionType.TRUE_OR_FALSE,
        title: "True or false?",
        options: [
          { optionText: "Correct", isCorrect: true },
          { optionText: "Incorrect", isCorrect: false },
        ],
      },
    ],
  },
  {
    name: "photo",
    questions: [
      {
        kind: "photo",
        type: QuestionType.PHOTO_QUESTION_SINGLE_CHOICE,
        title: "Photo single choice",
        imagePath: CURRICULUM_TEST_DATA.files.quizPhotoSingleChoice,
        options: ["A", "B"],
        correctIndexes: [0],
      },
      {
        kind: "photo",
        type: QuestionType.PHOTO_QUESTION_MULTIPLE_CHOICE,
        title: "Photo multiple choice",
        imagePath: CURRICULUM_TEST_DATA.files.quizPhotoMultipleChoice,
        options: ["A", "B", "C"],
        correctIndexes: [0, 2],
      },
    ],
    expected: [
      {
        type: QuestionType.PHOTO_QUESTION_SINGLE_CHOICE,
        title: "Photo single choice",
        photoS3Key: expect.stringMatching(/.+/),
        options: [
          { optionText: "A", isCorrect: true },
          { optionText: "B", isCorrect: false },
        ],
      },
      {
        type: QuestionType.PHOTO_QUESTION_MULTIPLE_CHOICE,
        title: "Photo multiple choice",
        photoS3Key: expect.stringMatching(/.+/),
        options: [
          { optionText: "A", isCorrect: true },
          { optionText: "B", isCorrect: false },
          { optionText: "C", isCorrect: true },
        ],
      },
    ],
  },
  {
    name: "fill-in-the-blanks",
    questions: [
      {
        kind: "fillBlanks",
        type: QuestionType.FILL_IN_THE_BLANKS_TEXT,
        title: "Fill text blanks",
        sentence: "The word appears twice in this sentence.",
        words: ["word", "word"],
      },
      {
        kind: "fillBlanks",
        type: QuestionType.FILL_IN_THE_BLANKS_DND,
        title: "Fill drag blanks",
        sentence: "Drag the same word into both blanks.",
        words: ["same", "same"],
      },
    ],
    expected: [
      {
        type: QuestionType.FILL_IN_THE_BLANKS_TEXT,
        title: "Fill text blanks",
        options: [
          { optionText: "word", isCorrect: true },
          { optionText: "word", isCorrect: true },
        ],
      },
      {
        type: QuestionType.FILL_IN_THE_BLANKS_DND,
        title: "Fill drag blanks",
        options: [
          { optionText: "same", isCorrect: true },
          { optionText: "same", isCorrect: true },
        ],
      },
    ],
  },
  {
    name: "partially scored matching",
    questions: [
      {
        kind: "matching",
        title: "Match the animal with its sound",
        pairs: [
          ["Cat", "Meow"],
          ["Dog", "Woof"],
        ],
        scoringMode: ASSESSMENT_SCORING_MODES.PARTIAL,
      },
    ],
    expected: [
      {
        type: QuestionType.MATCHING,
        title: "Match the animal with its sound",
        scoringMode: ASSESSMENT_SCORING_MODES.PARTIAL,
        options: [
          { optionText: "Cat", matchedWord: "Meow" },
          { optionText: "Dog", matchedWord: "Woof" },
        ],
      },
    ],
  },
  {
    name: "scale and open response",
    questions: [
      { kind: "titleOnly", type: QuestionType.SCALE_1_5, title: "How would you rate this lesson?" },
      { kind: "titleOnly", type: QuestionType.BRIEF_RESPONSE, title: "Brief response?" },
      { kind: "titleOnly", type: QuestionType.DETAILED_RESPONSE, title: "Detailed response?" },
    ],
    expected: [
      { type: QuestionType.SCALE_1_5, title: "How would you rate this lesson?" },
      { type: QuestionType.BRIEF_RESPONSE, title: "Brief response?" },
      { type: QuestionType.DETAILED_RESPONSE, title: "Detailed response?" },
    ],
  },
];
