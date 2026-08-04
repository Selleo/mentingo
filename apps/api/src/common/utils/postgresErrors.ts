const PG_UNIQUE_VIOLATION = "23505";

type PostgresErrorLike = {
  code?: string;
  constraint_name?: string;
  constraint?: string;
};

export function isPostgresUniqueViolation(err: unknown, constraintName: string): boolean {
  if (!err || typeof err !== "object") return false;

  const { code, constraint_name, constraint } = err as PostgresErrorLike;

  return (
    code === PG_UNIQUE_VIOLATION &&
    (constraint_name === constraintName || constraint === constraintName)
  );
}
