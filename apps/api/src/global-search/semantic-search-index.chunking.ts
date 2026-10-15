import { sanitizeRichTextSummary } from "@repo/shared";

import {
  SEMANTIC_SEARCH_MAX_CHUNKS,
  SEMANTIC_SEARCH_MAX_EXTRACTED_CHARACTERS,
} from "./semantic-search-index.constants";

/** Bounded paragraphs with overlap; Unicode code points avoid splitting surrogate pairs. */
export function chunkSearchText(text: string): string[] {
  const normalized = text
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!normalized) return [];
  if (normalized.length > SEMANTIC_SEARCH_MAX_EXTRACTED_CHARACTERS) {
    throw new Error("Search source exceeds the extracted-text indexing limit");
  }
  const chars = Array.from(normalized);
  const chunks: string[] = [];
  let start = 0;
  while (start < chars.length) {
    let end = Math.min(start + 2400, chars.length);
    if (end < chars.length) {
      const tail = chars.slice(start + 1200, end).join("");
      const breakAt = Math.max(tail.lastIndexOf("\n\n"), tail.lastIndexOf(" "));
      if (breakAt >= 0) end = start + 1200 + breakAt;
    }
    chunks.push(chars.slice(start, end).join("").trim());
    if (chunks.length > SEMANTIC_SEARCH_MAX_CHUNKS)
      throw new Error("Search source exceeds the chunk indexing limit");
    if (end === chars.length) break;
    start = Math.max(start + 1, end - 240);
  }
  return chunks;
}

export function normalizeSearchText(content: string): string {
  let text = content;
  if (/^\s*[\[{]/.test(content)) {
    try {
      const collect = (value: unknown): string[] => {
        if (Array.isArray(value)) return value.flatMap(collect);
        if (typeof value !== "object" || !value) return [];
        const node = value as Record<string, unknown>;
        return [
          typeof node.text === "string" ? node.text : "",
          ...collect(node.content),
          ...collect(node.children),
        ];
      };
      const parsed: unknown = JSON.parse(content);
      const collected = collect(parsed).filter(Boolean);
      if (collected.length) text = collected.join("\n");
    } catch {
      /* Ordinary text beginning with a bracket is still searchable. */
    }
  }
  const safe = sanitizeRichTextSummary(
    text.replace(/<\/(h[1-6]|p|div|li|section|article)>/gi, "</$1>\n"),
  );
  return safe
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(
      /&(?:amp|lt|gt|quot|apos|nbsp);/g,
      (entity) =>
        ({
          "&amp;": "&",
          "&lt;": "<",
          "&gt;": ">",
          "&quot;": '"',
          "&apos;": "'",
          "&nbsp;": " ",
        })[entity] ?? entity,
    )
    .trim();
}
