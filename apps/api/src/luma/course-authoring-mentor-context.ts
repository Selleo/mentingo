/** Builds retrieval text exclusively from content lessons in one authorized course export. */
import { load } from "cheerio";

import type { AuthoringMentorContextLesson } from "./course-authoring-context.types";
import type { AuthoringOperation } from "./schema/course-authoring-operations.schema";

/** Names the prepared course-context document map entry for its owning Mentor operation. */
export const mentorCourseContextKey = (operationId: string) => `${operationId}:course-context`;

/** Identifies a verified, operation-bound reference brief prepared from an authoring asset. */
export const mentorTargetedContextKey = (operationId: string) => `${operationId}:targeted-context`;

/** Extracts visible lesson text while removing executable and non-reader markup. */
const visibleText = (html: string) => {
  const $ = load(html, {}, false);
  $("script, style, noscript, iframe, svg, object").remove();
  $("img").each((_, image) => {
    const alt = $(image).attr("alt");
    $(image).replaceWith(alt ?? "");
  });
  $("br").replaceWith("\n");
  $("p, li, h1, h2, h3, h4, h5, h6, blockquote, pre, div, section, tr").each((_, block) => {
    $(block).append("\n");
  });
  return $.root()
    .text()
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
};

/**
 * Renders one Mentor knowledge file from current authorized course bodies and content operations
 * frozen in the same export. Updated lessons use their accepted export body instead of duplicating
 * the prior stored body. Quiz answers and Mentor instructions are intentionally not serialized.
 */
export function buildMentorCourseContextDocument(
  mentorTitle: string,
  existingLessons: readonly AuthoringMentorContextLesson[],
  operations: readonly AuthoringOperation[],
): string | null {
  const replacedLessonIds = new Set(
    operations.flatMap((operation) =>
      operation.type === "lesson.delete" || operation.type === "lesson.update"
        ? [operation.targetId]
        : [],
    ),
  );
  const deletedChapterIds = new Set(
    operations.flatMap((operation) =>
      operation.type === "chapter.delete" ? [operation.targetId] : [],
    ),
  );
  const sections: Array<{ chapterTitle: string | null; title: string; content: string }> = [];
  for (const lesson of existingLessons) {
    if (replacedLessonIds.has(lesson.id) || deletedChapterIds.has(lesson.chapterId)) continue;
    const title = lesson.title?.trim();
    const content = lesson.description ? visibleText(lesson.description) : "";
    if (!title || !content) continue;
    sections.push({ chapterTitle: lesson.chapterTitle, title, content });
  }

  for (const operation of operations) {
    if (
      (operation.type !== "lesson.create" && operation.type !== "lesson.update") ||
      operation.payload.lessonType !== "content" ||
      deletedChapterIds.has(operation.chapterId)
    )
      continue;
    const title = operation.payload.title.trim();
    const content = visibleText(operation.payload.description);
    if (!title || !content) continue;
    sections.push({ chapterTitle: null, title, content });
  }

  if (!sections.length) return null;
  const lines = [`Course content for AI Mentor: ${mentorTitle.trim() || "Mentor"}`, ""];
  for (const section of sections) {
    const heading = section.chapterTitle
      ? `## ${section.chapterTitle.trim()} / ${section.title}`
      : `## ${section.title}`;
    lines.push(heading, section.content, "");
  }
  return lines.join("\n");
}
