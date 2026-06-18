import { evaluateAiJudgeResult } from "src/ai/utils/judgeEvaluation";

describe("evaluateAiJudgeResult", () => {
  it("marks the result as passed when score meets the minimum", () => {
    expect(
      evaluateAiJudgeResult({
        summary: "Good work.",
        score: 3,
        minScore: 3,
        maxScore: 5,
      }),
    ).toEqual({
      summary: "Good work.",
      score: 3,
      minScore: 3,
      maxScore: 5,
      percentage: 60,
      passed: true,
    });
  });

  it("marks the result as failed when score is below the minimum", () => {
    expect(
      evaluateAiJudgeResult({
        summary: "Keep improving.",
        score: 2,
        minScore: 3,
        maxScore: 5,
      }),
    ).toEqual({
      summary: "Keep improving.",
      score: 2,
      minScore: 3,
      maxScore: 5,
      percentage: 40,
      passed: false,
    });
  });

  it("handles an empty score range without dividing by zero", () => {
    expect(
      evaluateAiJudgeResult({
        summary: "No criteria were available.",
        score: 0,
        minScore: 0,
        maxScore: 0,
      }),
    ).toEqual({
      summary: "No criteria were available.",
      score: 0,
      minScore: 0,
      maxScore: 0,
      percentage: 100,
      passed: true,
    });
  });
});
