/** Checks JSON values without coercing dates, class instances, or non-finite numbers. */
export function isJsonValue(value: unknown, remainingDepth = Infinity): boolean {
  if (remainingDepth < 0) return false;
  if (value === null) return true;

  switch (typeof value) {
    case "string":
    case "boolean":
      return true;
    case "number":
      return Number.isFinite(value);
    case "object": {
      if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) {
        return false;
      }

      const children = Array.isArray(value) ? Array.from(value) : Object.values(value);
      return children.every((child) => isJsonValue(child, remainingDepth - 1));
    }
    default:
      return false;
  }
}
