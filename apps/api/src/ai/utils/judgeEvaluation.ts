import type { AiJudgeJudgementBody, ResponseAiJudgeJudgementBody } from "src/ai/utils/ai.schema";

export const evaluateAiJudgeResult = (
  result: AiJudgeJudgementBody,
): ResponseAiJudgeJudgementBody => {
  const passed = result.score >= result.minScore;

  if (result.score === result.maxScore) {
    return { ...result, percentage: 100, passed };
  }

  const percentage = result.maxScore > 0 ? Math.ceil((result.score / result.maxScore) * 100) : 0;

  return { ...result, percentage, passed };
};
