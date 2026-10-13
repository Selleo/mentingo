import { sanitizeRichTextSummary } from "./sanitizeRichTextSummary";

/** Preserve title formatting without links, embeds, styles, or executable attributes.
 * Apply at persistence and rendering boundaries so older stored titles are safe too.
 */
export const sanitizeQuizQuestionTitle = (title: string): string => sanitizeRichTextSummary(title);
