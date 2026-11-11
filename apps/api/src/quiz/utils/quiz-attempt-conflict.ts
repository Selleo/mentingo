const POSTGRES_UNIQUE_VIOLATION = "23505";
const ATTEMPT_NUMBER_CONSTRAINT = "assessment_attempts_tenant_assessment_learner_number_idx";

type PostgresErrorLike = { code?: unknown; constraint_name?: unknown; cause?: unknown };

const isPostgresErrorLike = (error: unknown): error is PostgresErrorLike =>
  typeof error === "object" && error !== null;

/** True for the unique violation raised when two starts claim the same attempt number. */
export const isAttemptNumberConflict = (error: unknown): boolean => {
  if (!isPostgresErrorLike(error)) return false;
  if (
    error.code === POSTGRES_UNIQUE_VIOLATION &&
    error.constraint_name === ATTEMPT_NUMBER_CONSTRAINT
  )
    return true;
  return isAttemptNumberConflict(error.cause);
};
