import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";

import { AI_MENTOR_PRACTICE_STATUSES } from "src/ai/ai-practice.types";
import { responseAiJudgeJudgementSchema } from "src/ai/utils/ai.schema";
import { THREAD_STATUS } from "src/ai/utils/ai.type";
import { UUIDSchema } from "src/common";

const practiceScenarioSchema = Type.String({ minLength: 1, maxLength: 3000 });

export const createAiMentorPracticeSchema = Type.Object({
  language: Type.Enum(SUPPORTED_LANGUAGES),
  scenario: practiceScenarioSchema,
});

export const aiMentorPracticeSessionSchema = Type.Object({
  id: UUIDSchema,
  practiceDate: Type.String(),
  language: Type.Enum(SUPPORTED_LANGUAGES),
  title: Type.Union([Type.String(), Type.Null()]),
  aiMentorName: Type.Union([Type.String(), Type.Null()]),
  threadId: Type.Union([UUIDSchema, Type.Null()]),
  threadStatus: Type.Union([Type.Enum(THREAD_STATUS), Type.Null()]),
  taskGoal: Type.Union([Type.String(), Type.Null()]),
  evaluation: Type.Union([responseAiJudgeJudgementSchema, Type.Null()]),
  status: Type.Enum(AI_MENTOR_PRACTICE_STATUSES),
  errorCode: Type.Union([Type.String(), Type.Null()]),
});

export const nullableAiMentorPracticeSessionSchema = Type.Union([
  aiMentorPracticeSessionSchema,
  Type.Null(),
]);

export type CreateAiMentorPracticeBody = Static<typeof createAiMentorPracticeSchema>;
export type AiMentorPracticeSessionResponse = Static<typeof aiMentorPracticeSessionSchema>;
