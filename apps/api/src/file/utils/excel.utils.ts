export function normalizeHeader(h: unknown) {
  return String(h ?? "")
    .trim()
    .replace(/\r/g, "");
}

export function normalizeCellValue(
  header: string,
  cellValue: unknown,
): string | string[] | undefined {
  if (cellValue == null) return undefined;

  if (header === "groups" && typeof cellValue === "string") {
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
