const STATUS = "cmi.core.lesson_status";
const SCORE_KEYS = ["cmi.core.score.raw", "cmi.core.score.min", "cmi.core.score.max"];

export function isScormRetake(values: Record<string, string>) {
  return values[STATUS] === "not attempted" && SCORE_KEYS.every((key) => values[key] === "");
}

export function mergeScormProgress(
  existing: Record<string, string>,
  incoming: Record<string, string>,
) {
  const merged = { ...existing, ...incoming };
  if (!isScormRetake(incoming)) {
    const oldStatus = existing[STATUS];
    const nextStatus = incoming[STATUS];
    if (oldStatus === "passed" && nextStatus !== "passed") merged[STATUS] = oldStatus;
    else if (
      oldStatus === "completed" &&
      nextStatus &&
      !["passed", "completed", "failed"].includes(nextStatus)
    )
      merged[STATUS] = oldStatus;
  }
  return merged;
}
