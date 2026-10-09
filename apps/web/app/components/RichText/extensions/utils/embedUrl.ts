/** Admit browser HTTP(S) resources and explicitly allowed image-preview object URLs only. */
export const safeEmbedUrl = (value: unknown, allowImagePreview = false): string | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value, "https://rich-text.invalid/");
    if (
      !["http:", "https:"].includes(url.protocol) &&
      !(allowImagePreview && url.protocol === "blob:")
    )
      return null;
    return value.trim();
  } catch {
    return null;
  }
};
