const isStructuredJsonString = (value: string) => {
  const firstCharacter = value.at(0);
  const lastCharacter = value.at(-1);

  return (
    (firstCharacter === "{" && lastCharacter === "}") ||
    (firstCharacter === "[" && lastCharacter === "]")
  );
};

export const normalizeActivityLogMetadataValue = (value: unknown): unknown => {
  if (typeof value === "string") {
    const trimmedValue = value.trim();

    if (!isStructuredJsonString(trimmedValue)) return value;

    try {
      return normalizeActivityLogMetadataValue(JSON.parse(trimmedValue));
    } catch {
      return value;
    }
  }

  if (Array.isArray(value)) return value.map(normalizeActivityLogMetadataValue);

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        normalizeActivityLogMetadataValue(nestedValue),
      ]),
    );
  }

  return value;
};
