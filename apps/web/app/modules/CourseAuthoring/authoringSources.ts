/** Pulls web source links out of assistant markdown so they render as citation chips. */
export type AuthoringSourceLink = {
  url: string;
  label: string | null;
};

const MARKDOWN_LINK = /\[([^\]]*)\]\((https?:\/\/[^\s)]+)(?:\s+"[^"]*")?\)/g;
const BARE_URL = /<?(https?:\/\/[^\s<>)]+)>?/g;
const LIST_ITEM = /^\s*(?:[-*+•]|\d+[.)])\s+(.*)$/;
const SOURCES_HEADING =
  /^\s*(?:#{1,6}\s*)?(?:\*\*|__)?[\p{L}\s]{2,30}(?:\*\*|__)?:?(?:\*\*|__)?\s*$/u;
const MAX_REMAINING_TEXT = 80;

/** Returns a safe http(s) URL string, or null for anything else. */
export const safeHttpUrl = (value: string | null | undefined): string | null => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
};

/** Short, readable host used as the chip label. */
export const sourceDomain = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

const stripMarkdown = (value: string) =>
  value
    .replace(/[*_`~]/g, "")
    .replace(/^[\s\-–—:|·,]+|[\s\-–—:|·,.;]+$/g, "")
    .trim();

/** Parses one list item that is essentially a single source reference. */
const parseSourceItem = (content: string): AuthoringSourceLink | null => {
  const markdownLinks = [...content.matchAll(MARKDOWN_LINK)];
  if (markdownLinks.length > 1) return null;
  if (markdownLinks.length === 1) {
    const [match, text, href] = markdownLinks[0];
    const url = safeHttpUrl(href);
    const remaining = stripMarkdown(content.replace(match, ""));
    if (!url || remaining.length > MAX_REMAINING_TEXT) return null;
    const label = stripMarkdown(text) || remaining || null;
    return { url, label: label === url ? null : label };
  }

  const bareUrls = [...content.matchAll(BARE_URL)];
  if (bareUrls.length !== 1) return null;
  const url = safeHttpUrl(bareUrls[0][1].replace(/[.,;]+$/, ""));
  const remaining = stripMarkdown(content.replace(bareUrls[0][0], ""));
  if (!url || remaining.length > MAX_REMAINING_TEXT) return null;
  return { url, label: remaining || null };
};

/**
 * Removes a trailing list of source links (optionally introduced by a short heading such as
 * "Sources:") and returns them separately, deduplicated by URL.
 */
export const extractTrailingSources = (
  markdown: string,
): { text: string; sources: AuthoringSourceLink[] } => {
  const lines = markdown.replace(/\s+$/, "").split("\n");
  const collected: AuthoringSourceLink[] = [];
  let cursor = lines.length - 1;

  while (cursor >= 0) {
    const line = lines[cursor];
    if (!line.trim()) {
      cursor -= 1;
      continue;
    }
    const item = LIST_ITEM.exec(line);
    const source = item ? parseSourceItem(item[1]) : null;
    if (!source) break;
    collected.unshift(source);
    cursor -= 1;
  }

  if (collected.length === 0) return { text: markdown, sources: [] };

  let end = cursor;
  while (end >= 0 && !lines[end].trim()) end -= 1;
  if (
    end >= 0 &&
    SOURCES_HEADING.test(lines[end]) &&
    lines[end].replace(/[*_\s]+/g, "").endsWith(":")
  ) {
    end -= 1;
  } else if (end >= 0 && /^\s*#{1,6}\s/.test(lines[end]) && SOURCES_HEADING.test(lines[end])) {
    end -= 1;
  }

  const seen = new Set<string>();
  const sources = collected.filter((source) => {
    if (seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });

  return {
    text: lines
      .slice(0, end + 1)
      .join("\n")
      .replace(/\s+$/, ""),
    sources,
  };
};

const LINK_SEPARATOR =
  /(\]\(https?:\/\/[^)\s]+\))\s*(?:,|;|&|\band\b|\bi\b|\bund\b|\ba\b|\bir\b|\by\b|\bet\b)\s*(?=\[[^\]]*\]\(https?:\/\/)/gi;

/** Drops ", " or "and" between adjacent web links, since they render as chips. */
export const compactLinkSeparators = (markdown: string) => markdown.replace(LINK_SEPARATOR, "$1 ");
