/** Builds retrieval text exclusively from content lessons in one authorized course export. */
import { load } from "cheerio";

import {
  normalizeCourseAuthoringContent,
  replaceCourseAuthoringBlock,
} from "src/common/utils/courseAuthoringBlocks";

import { stripAuthoringHtmlStyles } from "./course-authoring-html";
import { orderCourseAuthoringOperations } from "./course-authoring-ordering";

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
 * frozen in the same export. All accepted patches are projected in native dependency order
 * before text extraction; partial updates preserve untouched baseline fields. Quiz answers and Mentor instructions are intentionally not serialized.
 */
export function buildMentorCourseContextDocument(
  mentorTitle: string,
  existingLessons: readonly AuthoringMentorContextLesson[],
  operations: readonly AuthoringOperation[],
  language?: AuthoringOperation["language"],
): string | null {
  const projected = new Map(existingLessons.map((lesson) => [lesson.id, { ...lesson }]));
  const replacedBodies = new Set<string>();
  const chapterTitles = new Map(
    existingLessons.map((lesson) => [lesson.chapterId, lesson.chapterTitle]),
  );
  const deletedChapterIds = new Set(
    operations.flatMap((operation) =>
      operation.type === "chapter.delete" ? [operation.targetId] : [],
    ),
  );
  for (const operation of orderCourseAuthoringOperations(operations)) {
    const sameLanguage = language === undefined || operation.language === language;
    switch (operation.type) {
      case "chapter.create":
      case "chapter.update":
        if (!sameLanguage) break;
        chapterTitles.set(operation.targetId, operation.payload.title);
        for (const lesson of projected.values())
          if (lesson.chapterId === operation.targetId)
            lesson.chapterTitle = operation.payload.title;
        break;
      case "chapter.delete":
        for (const lesson of projected.values())
          if (lesson.chapterId === operation.targetId) projected.delete(lesson.id);
        break;
      case "lesson.delete":
        projected.delete(operation.targetId);
        break;
      case "lesson.create":
      case "lesson.update": {
        if (!sameLanguage) break;
        if (operation.payload.lessonType !== "content") {
          projected.delete(operation.targetId);
          break;
        }
        replacedBodies.add(operation.targetId);
        projected.set(operation.targetId, {
          id: operation.targetId,
          chapterId: operation.chapterId,
          chapterTitle: chapterTitles.get(operation.chapterId) ?? null,
          title: operation.payload.title,
          description: stripAuthoringHtmlStyles(operation.payload.description),
        });
        break;
      }
      case "lesson.metadata.update": {
        const lesson = projected.get(operation.targetId);
        if (!lesson || !sameLanguage) break;
        if (operation.payload.description !== undefined) replacedBodies.add(lesson.id);
        projected.set(lesson.id, {
          ...lesson,
          ...(operation.payload.title !== undefined ? { title: operation.payload.title } : {}),
          ...(operation.payload.description !== undefined
            ? { description: stripAuthoringHtmlStyles(operation.payload.description) }
            : {}),
        });
        break;
      }
      case "lesson.block.replace": {
        const lesson = projected.get(operation.targetId);
        if (!lesson || !sameLanguage) break;
        projected.set(lesson.id, {
          ...lesson,
          description: replaceCourseAuthoringBlock({
            content: replacedBodies.has(lesson.id)
              ? normalizeCourseAuthoringContent(lesson.description ?? "")
              : (lesson.description ?? ""),
            targetBlockId: operation.payload.blockId,
            replacementHtml: stripAuthoringHtmlStyles(operation.payload.html),
          }),
        });
        replacedBodies.delete(lesson.id);
        break;
      }
      default:
        break;
    }
  }
  const sections = [...projected.values()].flatMap((lesson) => {
    if (deletedChapterIds.has(lesson.chapterId)) return [];
    const title = lesson.title?.trim();
    const content = lesson.description ? visibleText(lesson.description) : "";
    return title && content ? [{ chapterTitle: lesson.chapterTitle, title, content }] : [];
  });

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
