import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { Value } from "@sinclair/typebox/value";

import { aiMentorPracticeSessionSchema } from "src/ai/ai-practice.schema";
import { AI_MENTOR_PRACTICE_STATUSES } from "src/ai/ai-practice.types";
import { THREAD_STATUS } from "src/ai/utils/ai.type";
import { MENTOR_CONDUCT_BLOCKING_ERROR } from "src/ai/utils/mentor-conduct";

const practiceSession = (blockingErrorId: string | null) => ({
  id: "00000000-0000-4000-8000-000000000001",
  practiceDate: "2026-09-11",
  language: SUPPORTED_LANGUAGES.EN,
  title: "Practice",
  aiMentorName: "Mentor",
  threadId: "00000000-0000-4000-8000-000000000002",
  threadStatus: THREAD_STATUS.COMPLETED,
  taskGoal: "Goal",
  evaluation: {
    passed: false,
    minScore: 1,
    score: 0,
    maxScore: 1,
    percentage: 0,
    criteria: [],
    blockingErrors: [
      {
        blockingErrorId,
        description: MENTOR_CONDUCT_BLOCKING_ERROR.description,
        learnerSafeFeedback: "You insulted the client.",
      },
    ],
  },
  status: Object.values(AI_MENTOR_PRACTICE_STATUSES)[0],
  errorCode: null,
});

describe("aiMentorPracticeSessionSchema", () => {
  it("accepts a persisted conduct blocker without a configured blocking error id", () => {
    expect(Value.Check(aiMentorPracticeSessionSchema, practiceSession(null))).toBe(true);
  });

  it("accepts a configured blocking error id", () => {
    expect(
      Value.Check(
        aiMentorPracticeSessionSchema,
        practiceSession("00000000-0000-4000-8000-000000000003"),
      ),
    ).toBe(true);
  });
});
