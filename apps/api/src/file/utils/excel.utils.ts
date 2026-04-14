const camelCase = (value: string) =>
  value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((word, index) => {
      const normalized = word.toLowerCase();
      if (index === 0) return normalized;
      return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
    })
    .join("");

export function normalizeHeader(h: unknown) {
  const raw = String(h ?? "")
    .trim()
    .replace(/\r/g, " ");
  let normalized = "";

  if (/[^a-zA-Z0-9]+/.test(raw)) {
    normalized = camelCase(raw);
  } else if (raw) {
    normalized = `${raw.charAt(0).toLowerCase()}${raw.slice(1)}`;
  }

  return normalized === "role" ? "roleSlugs" : normalized;
}

export function normalizeCellValue(
  header: string,
  cellValue: unknown,
): string | string[] | undefined {
  if (cellValue == null) return undefined;

  if ((header === "groups" || header === "roleSlugs") && typeof cellValue === "string") {
    return cellValue
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  if (typeof cellValue === "object" && cellValue) {
    const anyVal = cellValue as any;
    const href = anyVal.hyperlink ?? anyVal.url ?? anyVal.link;
    if (typeof href === "string") {
      return href.replace(/^mailto:/, "").trim();
    }
  }

  const s = String(cellValue).trim();
  return s.length ? s : undefined;
}

export function isEmptyObject(obj: Record<string, any>) {
  return Object.keys(obj).length === 0;
}
