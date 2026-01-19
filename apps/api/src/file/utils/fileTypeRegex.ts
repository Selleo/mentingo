export const buildFileTypeRegex = (allowedTypes: readonly string[]) => {
  const escaped = allowedTypes.map((type) => type.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  return new RegExp(`^(${escaped.join("|")})$`);
};
