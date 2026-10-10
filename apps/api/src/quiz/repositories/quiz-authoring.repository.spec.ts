import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { PgDialect } from "drizzle-orm/pg-core";

import { QuizAuthoringRepository } from "./quiz-authoring.repository";

import type { QuizAuthoringQuestion } from "../types/quiz-authoring.types";
import type { SQL } from "drizzle-orm";
import type { DatabasePg } from "src/common";

const fixture = JSON.parse(
  readFileSync(
    resolve(__dirname, "../../../../../docs/contracts/course-authoring/quiz-operation.json"),
    "utf8",
  ),
) as { payload: { questions: QuizAuthoringQuestion[] } };

describe("QuizAuthoringRepository title sanitization", () => {
  const title = '<strong onclick="alert(1)">Question</strong><img src=x onerror="alert(1)">';
  const safeTitle = "<strong>Question</strong>";
  const question = { ...fixture.payload.questions[0], title };

  it("sanitizes question titles before inserting localized values", async () => {
    const values = jest.fn().mockResolvedValue(undefined);
    const trx = { insert: jest.fn(() => ({ values })) } as unknown as DatabasePg;
    const repository = new QuizAuthoringRepository({} as never, {} as never);

    await repository.insertQuestions(
      [{ ...question, assessmentId: "00000000-0000-4000-8000-000000000001" }],
      "en",
      trx,
    );

    const storedTitle = values.mock.calls[0][0][0].title as SQL;
    expect(new PgDialect().sqlToQuery(storedTitle).params).toEqual(["en", safeTitle]);
    expect(question.title).toBe(title);
  });

  it("sanitizes titles on updates without replacing other translations", async () => {
    const set = jest.fn((_values: Record<string, unknown>) => ({
      where: jest.fn().mockResolvedValue(undefined),
    }));
    const trx = { update: jest.fn(() => ({ set })) } as unknown as DatabasePg;
    const repository = new QuizAuthoringRepository({} as never, {} as never);

    await repository.updateQuestion(question, "pl", trx);

    const storedTitle = set.mock.calls[0][0].title as SQL;
    expect(new PgDialect().sqlToQuery(storedTitle).params).toEqual(["pl", safeTitle, true]);
  });
});
