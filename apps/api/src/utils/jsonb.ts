import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

export const tryParseJsonString = (value: string): unknown | undefined => {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
};

export const normalizeJsonb = <T>(value: unknown, fallback: T): T => {
  if (value === null || value === undefined) return fallback;

  if (typeof value === "string") {
    const parsed = tryParseJsonString(value);
    return parsed === undefined ? fallback : (parsed as T);
  }

  return value as T;
};

export const getLocalizedText = (
  value: unknown,
  language: string,
  fallbackToFirst = true,
): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const normalizedValue = typeof value === "string" ? (tryParseJsonString(value) ?? value) : value;

  if (typeof normalizedValue === "string") return normalizedValue;
  if (typeof normalizedValue === "object") {
    return extractLocalizedFromRecord(
      normalizedValue as Record<string, unknown>,
      language,
      fallbackToFirst,
    );
  }

  return String(normalizedValue);
};

export const toJsonbBuildObject = (value: unknown) =>
  settingsToJSONBuildObject(normalizeJsonb<Record<string, unknown>>(value, {}));

export const toNullableJsonbBuildObject = (value: unknown) => {
  if (value === null || value === undefined) return null;

  return toJsonbBuildObject(value);
};

const extractLocalizedFromRecord = (
  record: Record<string, unknown>,
  language: string,
  fallbackToFirst: boolean,
): string | null => {
  const byLanguage = record[language];
  if (typeof byLanguage === "string") return byLanguage;
  if (!fallbackToFirst) return null;

  const firstText = Object.values(record).find((item): item is string => typeof item === "string");

  return firstText ?? null;
};
