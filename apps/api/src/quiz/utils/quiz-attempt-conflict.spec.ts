import { isAttemptNumberConflict } from "./quiz-attempt-conflict";

describe("isAttemptNumberConflict", () => {
  const conflict = {
    code: "23505",
    constraint_name: "assessment_attempts_tenant_assessment_learner_number_idx",
  };

  it("matches the attempt-number unique violation, also when wrapped", () => {
    expect(isAttemptNumberConflict(conflict)).toBe(true);
    expect(isAttemptNumberConflict(Object.assign(new Error("wrapped"), { cause: conflict }))).toBe(
      true,
    );
  });

  it("ignores other errors", () => {
    expect(isAttemptNumberConflict({ code: "23505", constraint_name: "other" })).toBe(false);
    expect(isAttemptNumberConflict({ code: "40001" })).toBe(false);
    expect(isAttemptNumberConflict(new Error("boom"))).toBe(false);
    expect(isAttemptNumberConflict(null)).toBe(false);
  });
});
