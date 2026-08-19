export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const getStringProperty = (record: Record<string, unknown>, key: string): string | null => {
  const value = record[key];

  return typeof value === "string" && value.trim() ? value.trim() : null;
};
