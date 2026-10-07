import { createHash, randomUUID } from "node:crypto";

import { load as loadHtml } from "cheerio";

import type { AnyNode } from "domhandler";

export const AUTHORING_BLOCK_ID_ATTRIBUTE = "data-authoring-block-id";

const DERIVED_BLOCK_ATTRIBUTES = ["data-autoplay", "data-block-index"] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const COURSE_AUTHORING_BLOCK_ERROR = {
  DUPLICATE_ID: "duplicate_id",
  INVALID_CONTENT: "invalid_content",
  MALFORMED_ID: "malformed_id",
  MISSING_TARGET: "missing_target",
  INVALID_REPLACEMENT: "invalid_replacement",
  REPLACEMENT_ID_MISMATCH: "replacement_id_mismatch",
} as const;

type CourseAuthoringBlockErrorCode =
  (typeof COURSE_AUTHORING_BLOCK_ERROR)[keyof typeof COURSE_AUTHORING_BLOCK_ERROR];

export class CourseAuthoringBlockError extends Error {
  constructor(
    public readonly code: CourseAuthoringBlockErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CourseAuthoringBlockError";
  }
}

type AuthoringBlock = {
  element: AnyNode;
  id: string | null;
};

const getTopLevelElements = (content: string) => {
  const $ = loadHtml(content);
  const body = $("body");
  const nodes = body.contents().toArray();
  const unsupportedText = nodes.find(
    (node) => node.type === "text" && $(node).text().trim().length > 0,
  );
  if (unsupportedText) {
    throw new CourseAuthoringBlockError(
      COURSE_AUTHORING_BLOCK_ERROR.INVALID_CONTENT,
      "Course authoring content must use top-level HTML elements",
    );
  }

  const elements = nodes.filter((node) => node.type === "tag");
  const nestedIdentity = elements.find(
    (element) => $(element).find(`[${AUTHORING_BLOCK_ID_ATTRIBUTE}]`).length > 0,
  );
  if (nestedIdentity) {
    throw new CourseAuthoringBlockError(
      COURSE_AUTHORING_BLOCK_ERROR.INVALID_CONTENT,
      "Authoring block IDs are allowed only on top-level elements",
    );
  }
  return { $, elements };
};

const readAndValidateBlockIds = (content: string, options: { requireIds: boolean }) => {
  const { $, elements } = getTopLevelElements(content);
  const seenIds = new Set<string>();
  const blocks: AuthoringBlock[] = elements.map((element) => {
    const id = $(element).attr(AUTHORING_BLOCK_ID_ATTRIBUTE) ?? null;

    if (id !== null && !UUID_PATTERN.test(id)) {
      throw new CourseAuthoringBlockError(
        COURSE_AUTHORING_BLOCK_ERROR.MALFORMED_ID,
        `Authoring block ID is not a UUID: ${id}`,
      );
    }
    if (id !== null && seenIds.has(id.toLowerCase())) {
      throw new CourseAuthoringBlockError(
        COURSE_AUTHORING_BLOCK_ERROR.DUPLICATE_ID,
        `Authoring block ID is duplicated: ${id}`,
      );
    }
    if (options.requireIds && id === null) {
      throw new CourseAuthoringBlockError(
        COURSE_AUTHORING_BLOCK_ERROR.MALFORMED_ID,
        "Authoring block ID is missing",
      );
    }

    if (id !== null) seenIds.add(id.toLowerCase());
    return { element, id };
  });

  return { $, blocks };
};

const serializeContent = ($: ReturnType<typeof loadHtml>) => $("body").html() ?? "";

const ALLOWED_AUTHORING_TAGS = new Set([
  "a",
  "b",
  "blockquote",
  "br",
  "code",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "s",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
]);
const VOID_AUTHORING_TAGS = new Set(["br", "hr", "img"]);

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

/** Distinguishes supported rich text from plain or unsupported markup-like text. */
const supportedMarkup = (content: string) => {
  const looksLikeMarkup = /<\s*\/?\s*[a-z][a-z0-9-]*/i.test(content);
  if (!looksLikeMarkup) return false;

  const tokens = content.match(/<[^<>]*>/g) ?? [];
  const unmatchedAngles = content.replace(/<[^<>]*>/g, "");
  if (tokens.length === 0 || unmatchedAngles.includes("<")) {
    throw new CourseAuthoringBlockError(
      COURSE_AUTHORING_BLOCK_ERROR.INVALID_CONTENT,
      "Course authoring content contains malformed HTML",
    );
  }

  const stack: string[] = [];
  for (const token of tokens) {
    if (/^<!--/.test(token)) continue;
    const match = token.match(/^<\s*(\/?)\s*([a-z][a-z0-9-]*)\b([^>]*)>$/i);
    if (!match) {
      throw new CourseAuthoringBlockError(
        COURSE_AUTHORING_BLOCK_ERROR.INVALID_CONTENT,
        "Course authoring content contains malformed HTML",
      );
    }
    const [, closing, rawTag, attributes] = match;
    const tag = rawTag.toLowerCase();
    if (!ALLOWED_AUTHORING_TAGS.has(tag)) return false;
    if (closing) {
      if (attributes.trim() || stack.pop() !== tag) {
        throw new CourseAuthoringBlockError(
          COURSE_AUTHORING_BLOCK_ERROR.INVALID_CONTENT,
          "Course authoring content contains malformed HTML",
        );
      }
      continue;
    }
    if (VOID_AUTHORING_TAGS.has(tag) || /\/\s*$/.test(attributes)) continue;
    stack.push(tag);
  }
  if (stack.length > 0) {
    throw new CourseAuthoringBlockError(
      COURSE_AUTHORING_BLOCK_ERROR.INVALID_CONTENT,
      "Course authoring content contains malformed HTML",
    );
  }
  return true;
};

/** Wraps plain lesson copy safely while preserving valid, block-shaped lesson HTML. */
export const normalizeCourseAuthoringContent = (
  content: string,
  createId: () => string = randomUUID,
) => {
  const html = supportedMarkup(content)
    ? content
    : `<p>${escapeHtml(content)}</p>`;
  return normalizeCourseAuthoringBlocks(html, createId);
};

export const normalizeCourseAuthoringBlocks = (
  content: string,
  createId: () => string = randomUUID,
) => {
  const { $, blocks } = readAndValidateBlockIds(content, { requireIds: false });

  blocks.forEach((block) => {
    if (block.id !== null) return;
    const id = createId();
    if (!UUID_PATTERN.test(id)) {
      throw new CourseAuthoringBlockError(
        COURSE_AUTHORING_BLOCK_ERROR.MALFORMED_ID,
        `Generated authoring block ID is not a UUID: ${id}`,
      );
    }
    $(block.element).attr(AUTHORING_BLOCK_ID_ATTRIBUTE, id);
    block.id = id;
  });

  const normalizedIds = blocks.map((block) => block.id);
  if (new Set(normalizedIds.map((id) => id?.toLowerCase())).size !== normalizedIds.length) {
    throw new CourseAuthoringBlockError(
      COURSE_AUTHORING_BLOCK_ERROR.DUPLICATE_ID,
      "Generated authoring block IDs are not unique",
    );
  }

  return serializeContent($);
};

export const replaceCourseAuthoringBlock = (params: {
  content: string;
  targetBlockId: string;
  replacementHtml: string;
}) => {
  if (!UUID_PATTERN.test(params.targetBlockId)) {
    throw new CourseAuthoringBlockError(
      COURSE_AUTHORING_BLOCK_ERROR.MALFORMED_ID,
      `Target authoring block ID is not a UUID: ${params.targetBlockId}`,
    );
  }

  const { $, blocks } = readAndValidateBlockIds(params.content, { requireIds: true });
  const target = blocks.find((block) => block.id === params.targetBlockId);
  if (!target) {
    throw new CourseAuthoringBlockError(
      COURSE_AUTHORING_BLOCK_ERROR.MISSING_TARGET,
      `Authoring block does not exist: ${params.targetBlockId}`,
    );
  }

  const replacement = readAndValidateBlockIds(params.replacementHtml, { requireIds: false });
  if (replacement.blocks.length !== 1) {
    throw new CourseAuthoringBlockError(
      COURSE_AUTHORING_BLOCK_ERROR.INVALID_REPLACEMENT,
      "A block replacement must contain exactly one top-level element",
    );
  }

  const replacementBlock = replacement.blocks[0];
  if (replacementBlock.id !== null && replacementBlock.id !== params.targetBlockId) {
    throw new CourseAuthoringBlockError(
      COURSE_AUTHORING_BLOCK_ERROR.REPLACEMENT_ID_MISMATCH,
      "A replacement cannot change the target authoring block ID",
    );
  }

  replacement.$(replacementBlock.element).attr(AUTHORING_BLOCK_ID_ATTRIBUTE, params.targetBlockId);
  $(target.element).replaceWith(replacement.$.html(replacementBlock.element));

  return serializeContent($);
};

export const getCourseAuthoringContentFingerprint = (content: string) => {
  const { $, blocks } = readAndValidateBlockIds(content, { requireIds: true });

  blocks.forEach(({ element }) => {
    DERIVED_BLOCK_ATTRIBUTES.forEach((attribute) => $(element).removeAttr(attribute));
    $(element)
      .find("*")
      .each((_index, descendant) => {
        DERIVED_BLOCK_ATTRIBUTES.forEach((attribute) => $(descendant).removeAttr(attribute));
      });
  });

  return createHash("sha256").update(serializeContent($)).digest("hex");
};

export const getCourseAuthoringBlocks = (content: string) => {
  const { $, blocks } = readAndValidateBlockIds(content, { requireIds: false });
  return blocks.flatMap(({ id, element }) => {
    if (!id) return [];
    const html = $.html(element);
    return [{ id, html, baselineHash: getCourseAuthoringContentFingerprint(html) }];
  });
};
