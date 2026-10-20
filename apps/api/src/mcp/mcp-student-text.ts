import { sanitizeRichTextSummary } from "@repo/shared";

export const MCP_STUDENT_MAX_TEXT_LENGTH = 16000;

/** One text projection for both output and matching: hidden markup never affects search. */
export function mcpStudentText(value: string | null | undefined): string {
  return sanitizeRichTextSummary(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function boundedMcpStudentText(
  value: string | null | undefined,
  maxLength = MCP_STUDENT_MAX_TEXT_LENGTH,
) {
  const text = mcpStudentText(value);
  return { text: text.slice(0, maxLength), truncated: text.length > maxLength };
}
