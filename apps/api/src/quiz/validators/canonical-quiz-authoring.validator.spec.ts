import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { FormatRegistry } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { validate } from "uuid";

import { authoringOperationSchema } from "src/luma/schema/course-authoring-operations.schema";

import { validateCanonicalQuizQuestions } from "./canonical-quiz-authoring.validator";

describe("canonical generated assessment validation", () => {
  FormatRegistry.Set("uuid", validate);
  const fixture: unknown = JSON.parse(readFileSync(resolve(__dirname, "../../../../../docs/contracts/course-authoring/quiz-operation.json"), "utf8"));
  if (!Value.Check(authoringOperationSchema, fixture) || fixture.type !== "lesson.update" || fixture.payload.lessonType !== "quiz") throw new Error("Invalid fixture");
  const questions = fixture.payload.questions;

  it("accepts all ten supported question families from the producer", () => {
    expect(new Set(questions.map((question) => question.questionType)).size).toBe(10);
    expect(validateCanonicalQuizQuestions(questions)).toEqual([]);
  });

  it("rejects an automatic single choice with no correct answer", () => {
    const question = questions.find((item) => item.questionType === "single_choice")!;
    expect(validateCanonicalQuizQuestions([{ ...question, options: question.options.map((option) => ({ ...option, isCorrect: false })) }])).toContain("invalid_choice_answers");
  });

  it("rejects blank markers pointing at different answer identities", () => {
    const question = questions.find((item) => item.questionType === "fill_in_the_blanks_text")!;
    expect(validateCanonicalQuizQuestions([{ ...question, prompt: "Missing marker" }])).toContain("invalid_blank_markers");
  });

  it("rejects orphan drag targets and incomplete scales", () => {
    const question = questions.find((item) => item.questionType === "fill_in_the_blanks_dnd")!;
    expect(validateCanonicalQuizQuestions([{ ...question, dragAndDropOptions: [] }])).toContain("invalid_drag_targets");
    const scale = questions.find((item) => item.questionType === "scale_1_5")!;
    expect(validateCanonicalQuizQuestions([{ ...scale, scaleOptions: scale.scaleOptions.slice(1) }])).toContain("invalid_scale");
  });
});
