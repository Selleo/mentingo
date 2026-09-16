import { isQuizExpired, quizDeadline, shuffleQuizIds } from "./quiz-attempt.repository";
import { mergeQuizSettings } from "./quiz-settings";

import type { QuizAttemptState } from "./quiz.types";

const now = Date.parse("2026-09-15T12:00:00Z");
const state: QuizAttemptState = {
  id: "attempt",
  status: "active",
  startedAt: new Date(now).toISOString(),
  expiresAt: new Date(now + 60_000).toISOString(),
  questionOrder: [],
  optionOrder: {},
};

describe("quiz attempt rules", () => {
  it("uses the earlier closing time and per-attempt deadline", () => {
    expect(
      quizDeadline(
        { timeLimitMinutes: 10, availableUntil: new Date(now + 120_000).toISOString() },
        now,
      ),
    ).toBe(new Date(now + 120_000).toISOString());
    expect(
      quizDeadline(
        { timeLimitMinutes: 1, availableUntil: new Date(now + 120_000).toISOString() },
        now,
      ),
    ).toBe(new Date(now + 60_000).toISOString());
    expect(quizDeadline({}, now)).toBeNull();
  });
  it("expires exactly at the deadline without expiring submitted attempts", () => {
    expect(isQuizExpired(state, now + 59_999)).toBe(false);
    expect(isQuizExpired(state, now + 60_000)).toBe(true);
    expect(isQuizExpired({ ...state, status: "submitted" }, now + 60_000)).toBe(false);
  });
  it("shuffles without changing IDs or mutating the source", () => {
    const ids = ["a", "b", "c", "d", "e"];
    for (let index = 0; index < 10; index += 1) expect(shuffleQuizIds(ids).sort()).toEqual(ids);
    expect(ids).toEqual(["a", "b", "c", "d", "e"]);
  });
  it("preserves other feedback languages and rejects inverted availability", () => {
    expect(
      mergeQuizSettings({ passedFeedback: "Dobrze" }, "pl", { passedFeedback: { en: "Good" } }),
    ).toEqual({ passedFeedback: { en: "Good", pl: "Dobrze" } });
    expect(() =>
      mergeQuizSettings(
        { availableFrom: "2026-10-02T12:00:00Z", availableUntil: "2026-10-01T12:00:00Z" },
        "en",
      ),
    ).toThrow();
  });
});
