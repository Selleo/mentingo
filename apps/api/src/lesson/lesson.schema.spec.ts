import { Value } from "@sinclair/typebox/value";

import { createChapterSchema, updateChapterSchema } from "src/chapter/schemas/chapter.schema";

import { QUESTION_TYPE } from "../questions/schema/question.types";

import {
  adminOptionSchema,
  adminQuestionResponseSchema,
  createLessonSchema,
  createQuizLessonSchema,
  lessonSchema,
  optionSchema,
  updateLessonSchema,
} from "./lesson.schema";
import { LESSON_TYPES } from "./lesson.type";

const id = "b1473a0a-6d90-49ff-8777-c5d746aa3028";
const optionText =
  "Rozdzielić zakresy i profile według wymagań grup (w tym osobno ocenić typ oraz wymaganie logowania dla administratorów), sprawdzić obsługę aplikacji i urządzeń, dobrać metodę do współdzielonych stanowisk, a następnie w pilotażu dodać i przetestować zapasowe metody oraz odzyskiwanie przed rozszerzeniem wdrożenia.";
const option = { optionText, displayOrder: 0, isCorrect: true };
const question = { type: QUESTION_TYPE.SINGLE_CHOICE, title: "Co zrobić?", options: [option] };
const lesson = {
  id,
  title: "Quiz",
  type: LESSON_TYPES.QUIZ,
  displayOrder: 0,
  questions: [question],
};

describe("Quiz option response compatibility", () => {
  it("returns complete canonical answers longer than the legacy editor limit", () => {
    expect(optionText.length).toBeGreaterThan(250);
    expect(Value.Check(adminQuestionResponseSchema, question)).toBe(true);
    expect(Value.Check(lessonSchema, lesson)).toBe(true);
    expect(
      Value.Check(optionSchema, {
        ...option,
        id,
        isStudentAnswer: null,
        studentAnswer: null,
      }),
    ).toBe(true);
  });

  it("keeps the legacy input limit for create and update", () => {
    expect(Value.Check(adminOptionSchema, option)).toBe(false);
    expect(Value.Check(adminOptionSchema, { ...option, optionText: "a".repeat(250) })).toBe(true);
    expect(Value.Check(createLessonSchema, { ...lesson, chapterId: id })).toBe(false);
    expect(Value.Check(updateLessonSchema, { questions: [question], language: "pl" })).toBe(false);
    const chapter = { title: "Rozdział", courseId: id, lessons: [lesson] };
    expect(Value.Check(createChapterSchema, chapter)).toBe(false);
    expect(Value.Check(updateChapterSchema, { ...chapter, language: "pl" })).toBe(false);
    expect(
      Value.Check(createQuizLessonSchema, {
        ...lesson,
        chapterId: id,
        description: "",
        thresholdScore: 80,
        attemptsLimit: null,
        quizCooldownInHours: null,
      }),
    ).toBe(false);
  });

  it("still rejects invalid response types", () => {
    expect(
      Value.Check(adminQuestionResponseSchema, {
        ...question,
        options: [{ ...option, optionText: 12 }],
      }),
    ).toBe(false);
  });
});
