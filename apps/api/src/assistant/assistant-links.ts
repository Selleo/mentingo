import {
  ASSISTANT_SOURCE_TYPES,
  sanitizeRichTextSummary,
  type AssistantSourceType,
} from "@repo/shared";

import {
  isMcpHelpdeskTool,
  MCP_HELPDESK_GUIDANCE_KIND,
} from "src/mcp/mcp-self-onboarding.constants";

import type { AssistantSource } from "./assistant.types";

const previewText = (value: string, maxLength: number) =>
  sanitizeRichTextSummary(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

/** Validate the returned identity against an actual web destination; never promote file or arbitrary URLs. */
function sourceType(
  row: Record<string, unknown>,
  url: URL,
  allowHelpdesk: boolean,
): AssistantSourceType | undefined {
  if (row.entityType === ASSISTANT_SOURCE_TYPES.HELPDESK) {
    if (!allowHelpdesk || row.guidanceKind !== MCP_HELPDESK_GUIDANCE_KIND || url.hash) return;
    if (
      typeof row.tutorialKey !== "string" ||
      !/^[a-z0-9][a-z0-9._-]{0,127}$/.test(row.tutorialKey)
    )
      return;
    if (url.pathname !== `/helpdesk/tutorials/${encodeURIComponent(row.tutorialKey)}`) return;
    const parameters = [...url.searchParams.entries()];
    if (typeof row.chapterId === "string") {
      if (!/^[a-z0-9][a-z0-9._-]{0,127}$/.test(row.chapterId)) return;
      if (
        parameters.length !== 1 ||
        parameters[0][0] !== "chapter" ||
        parameters[0][1] !== row.chapterId
      )
        return;
    } else if (parameters.length) return;
    return ASSISTANT_SOURCE_TYPES.HELPDESK;
  }
  const id = typeof row.id === "string" ? encodeURIComponent(row.id) : undefined;
  if (!id || url.hash) return;
  if (url.search && !["/qa", "/development-paths"].includes(url.pathname)) return;
  if (url.pathname === "/qa" && [...url.searchParams.keys()].some((key) => key !== "qaId")) return;
  if (
    url.pathname === "/development-paths" &&
    [...url.searchParams.keys()].some((key) => key !== "searchQuery")
  )
    return;
  if (url.pathname === `/course/${id}` || url.pathname === `/admin/beta-courses/${id}`)
    return ASSISTANT_SOURCE_TYPES.COURSE;
  if (url.pathname === `/profile/${id}` || url.pathname === `/admin/users/${id}`)
    return ASSISTANT_SOURCE_TYPES.USER;
  if (url.pathname === `/admin/groups/${id}`) return ASSISTANT_SOURCE_TYPES.GROUP;
  if (url.pathname === `/admin/categories/${id}`) return ASSISTANT_SOURCE_TYPES.CATEGORY;
  if (url.pathname === `/articles/${id}` || url.pathname === `/articles/${id}/edit`)
    return ASSISTANT_SOURCE_TYPES.ARTICLE;
  if (url.pathname === `/news/${id}` || url.pathname === `/news/${id}/edit`)
    return ASSISTANT_SOURCE_TYPES.NEWS;
  if (
    url.pathname === `/qa/${id}` ||
    (url.pathname === "/qa" && url.searchParams.get("qaId") === row.id)
  )
    return ASSISTANT_SOURCE_TYPES.QA;
  if (
    url.pathname === "/development-paths" &&
    typeof row.title === "string" &&
    url.searchParams.get("searchQuery") === row.title
  )
    return ASSISTANT_SOURCE_TYPES.DEVELOPMENT_PATH;
  if (typeof row.courseId === "string") {
    const course = encodeURIComponent(row.courseId);
    if (url.pathname === `/course/${course}/lesson/${id}`) return ASSISTANT_SOURCE_TYPES.LESSON;
    if (
      (row.entityType === ASSISTANT_SOURCE_TYPES.LESSON ||
        row.entityType === ASSISTANT_SOURCE_TYPES.RESOURCE) &&
      url.pathname === `/admin/beta-courses/${course}`
    )
      return row.entityType;
    if (
      row.entityType === ASSISTANT_SOURCE_TYPES.RESOURCE &&
      typeof row.lessonId === "string" &&
      url.pathname === `/course/${course}/lesson/${encodeURIComponent(row.lessonId)}`
    )
      return ASSISTANT_SOURCE_TYPES.RESOURCE;
  }
}

/** Only authorized tool metadata is saved for previews. Product guidance additionally
 * requires a registered Helpdesk tool origin; a marked URL in other data is insufficient. */
export function collectAssistantSources(
  result: unknown,
  origin: string,
  toolName?: string,
): AssistantSource[] {
  const allowHelpdesk = typeof toolName === "string" && isMcpHelpdeskTool(toolName);
  const sources = new Map<string, AssistantSource>();
  const visit = (value: unknown, depth: number) => {
    if (depth > 12 || !value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, depth + 1));
      return;
    }
    const row = value as Record<string, unknown>;
    if (typeof row.url === "string") {
      try {
        const url = new URL(row.url);
        const entityType = sourceType(row, url, allowHelpdesk);
        if (entityType && url.origin === new URL(origin).origin && !url.username && !url.password) {
          let title = [row.firstName, row.lastName]
            .filter((part) => typeof part === "string")
            .join(" ");
          if (typeof row.name === "string") title = row.name;
          if (typeof row.title === "string") title = row.title;
          const description =
            entityType === ASSISTANT_SOURCE_TYPES.USER
              ? undefined
              : [row.summary, row.description, row.matchedPassage].find(
                  (value): value is string => typeof value === "string" && value.trim().length > 0,
                );
          if (title)
            sources.set(url.href, {
              title: previewText(title, 500),
              url: url.href,
              entityType,
              ...(description ? { description: previewText(description, 300) } : {}),
            });
        }
      } catch {
        /* Invalid tool URLs are never promoted into references. */
      }
    }
    Object.values(row).forEach((item) => visit(item, depth + 1));
  };
  visit(result, 0);
  return [...sources.values()].slice(0, 100);
}

/** Persist only verified links, and make exact unambiguous returned titles clickable without fuzzy entity matching. */
export function groundAssistantText(text: string, sources: AssistantSource[]): string {
  const allowed = new Set(sources.map((source) => source.url));
  const grounded = text
    .slice(0, 100_000)
    .replace(/<[^>]*>/g, "")
    .replace(/\[([^\]]*)\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g, (_match, title: string, url: string) =>
      allowed.has(url) ? `[${title}](${url})` : title,
    )
    .replace(/https?:\/\/[^\s)<>\]]+/g, (url) =>
      allowed.has(url) ? url : "[unverified link omitted]",
    );
  const unique = new Map<string, AssistantSource | null>();
  for (const source of sources) {
    const previous = unique.get(source.title);
    if (previous === null || (previous && previous.url !== source.url))
      unique.set(source.title, null);
    else unique.set(source.title, source);
  }
  const candidates = [...unique.values()]
    .filter((source): source is AssistantSource => Boolean(source && source.title.length >= 3))
    .sort((a, b) => b.title.length - a.title.length);
  if (!candidates.length) return grounded;
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const names = new RegExp(
    String.raw`(?<![\p{L}\p{N}_])(${candidates
      .map((source) => escape(source.title))
      .join("|")})(?![\p{L}\p{N}_])`,
    "gu",
  );
  // Preserve existing Markdown destinations and code verbatim; never relink inside them.
  return grounded
    .split(/(```[\s\S]*?```|`[^`]*`|\[[^\]]*\]\([^)]*\)|https?:\/\/[^\s)<>\]]+)/g)
    .map((part, index) =>
      index % 2
        ? part
        : part.replace(
            names,
            (title) => `[${title.replace(/[\[\]\\]/g, "\\$&")}](${unique.get(title)!.url})`,
          ),
    )
    .join("");
}

/** The durable run registry may contain search candidates; the visible message contains only actual citations. */
export function selectAssistantSources(
  text: string,
  sources: AssistantSource[],
): AssistantSource[] {
  const urls = new Set(text.match(/https?:\/\/[^\s)<>\]]+/g) ?? []);
  return sources.filter((source) => urls.has(source.url));
}

/** Metadata-only lookup results do not establish readable lesson/article content. */
export function hasAssistantReadableContent(name: string, result: unknown): boolean {
  if (
    !["get_lesson", "get_article", "get_news", "get_qa_entry"].includes(name) ||
    !result ||
    typeof result !== "object"
  )
    return false;
  const root = result as Record<string, unknown>;
  const value = root.lesson ?? root.article ?? root.news ?? root.qa ?? root;
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (name === "get_lesson" && row.contentReadSupported === false) return false;
  return [row.content, row.answer, row.description].some(
    (text) => typeof text === "string" && text.replace(/<[^>]*>/g, " ").trim().length > 0,
  );
}
