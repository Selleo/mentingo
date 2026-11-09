import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { ASSESSMENT_QUESTION_TYPES, ASSESSMENT_SCORING_MODES } from "@repo/shared";
import { FormatRegistry } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { validate } from "uuid";

import { authoringOperationSchema } from "src/luma/schema/course-authoring-operations.schema";

import { validateCanonicalQuizQuestions } from "./canonical-quiz-authoring.validator";

describe("canonical generated assessment validation", () => {
  FormatRegistry.Set("uuid", validate);
  const fixture: unknown = JSON.parse(
    readFileSync(
      resolve(__dirname, "../../../../../docs/contracts/course-authoring/quiz-operation.json"),
      "utf8",
    ),
  );
  if (
    !Value.Check(authoringOperationSchema, fixture) ||
    fixture.type !== "lesson.update" ||
    fixture.payload.lessonType !== "quiz"
  )
    throw new Error("Invalid fixture");
  const questions = fixture.payload.questions.map((question) => ({
    ...question,
    scoringMode: ASSESSMENT_SCORING_MODES.ALL_OR_NOTHING,
    matchingPairs: [],
  }));
  const matchingQuestion = {
    ...questions[0],
    questionType: ASSESSMENT_QUESTION_TYPES.MATCHING,
    scoringMode: ASSESSMENT_SCORING_MODES.PARTIAL,
    options: [],
    trueFalseStatements: [],
    scaleOptions: [],
    openTextSettings: null,
    blanks: [],
    dragAndDropOptions: [],
    matchingPairs: [
      { id: "00000000-0000-4000-8000-000000000101", displayOrder: 1, prompt: "Cat", match: "Meow" },
      { id: "00000000-0000-4000-8000-000000000102", displayOrder: 2, prompt: "Dog", match: "Woof" },
    ],
  };

  it("accepts all ten supported question families from the producer", () => {
    expect(new Set(questions.map((question) => question.questionType)).size).toBe(10);
    expect(validateCanonicalQuizQuestions(questions)).toEqual([]);
  });

  it("rejects an automatic single choice with no correct answer", () => {
    const question = questions.find((item) => item.questionType === "single_choice")!;
    expect(
      validateCanonicalQuizQuestions([
        {
          ...question,
          options: question.options.map((option) => ({ ...option, isCorrect: false })),
        },
      ]),
    ).toContain("invalid_choice_answers");
  });

  it("rejects blank markers pointing at different answer identities", () => {
    const question = questions.find((item) => item.questionType === "fill_in_the_blanks_text")!;
    expect(validateCanonicalQuizQuestions([{ ...question, prompt: "Missing marker" }])).toContain(
      "invalid_blank_markers",
    );
  });

  it("rejects orphan drag targets and incomplete scales", () => {
    const question = questions.find((item) => item.questionType === "fill_in_the_blanks_dnd")!;
    expect(validateCanonicalQuizQuestions([{ ...question, dragAndDropOptions: [] }])).toContain(
      "invalid_drag_targets",
    );
    const scale = questions.find((item) => item.questionType === "scale_1_5")!;
    expect(
      validateCanonicalQuizQuestions([{ ...scale, scaleOptions: scale.scaleOptions.slice(1) }]),
    ).toContain("invalid_scale");
  });

  it("accepts a matching question with at least two complete pairs", () => {
    expect(validateCanonicalQuizQuestions([matchingQuestion])).toEqual([]);
  });

  it("rejects matching questions with too few or incomplete pairs", () => {
    expect(
      validateCanonicalQuizQuestions([
        { ...matchingQuestion, matchingPairs: matchingQuestion.matchingPairs.slice(1) },
      ]),
    ).toContain("invalid_matching_pairs");
    expect(
      validateCanonicalQuizQuestions([
        {
          ...matchingQuestion,
          matchingPairs: [
            { ...matchingQuestion.matchingPairs[0], match: " " },
            matchingQuestion.matchingPairs[1],
          ],
        },
      ]),
    ).toContain("invalid_matching_pairs");
  });

  it("rejects partial scoring outside matching questions", () => {
    expect(
      validateCanonicalQuizQuestions([
        { ...questions[0], scoringMode: ASSESSMENT_SCORING_MODES.PARTIAL },
      ]),
    ).toContain("unexpected_partial_scoring");
  });
});
