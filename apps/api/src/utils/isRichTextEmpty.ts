import { decode } from "html-entities";

export function isRichTextEmpty(input: string): boolean {
  if (!input) return true;

  const decoded = decode(input);
  const stripped = decoded.replace(/<\/?[^>]+(>|$)/g, "");
  const cleaned = stripped.replace(/\u200B/g, "").trim();

  return cleaned.length === 0;
}
