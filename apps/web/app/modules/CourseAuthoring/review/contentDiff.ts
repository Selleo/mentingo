import { BLOCK_DIFF_STATUS, WORD_DIFF_TYPE } from "./curriculumReview.constants";

export const AUTHORING_BLOCK_ID_ATTRIBUTE = "data-authoring-block-id";

export type ContentBlock = { id: string | null; html: string; text: string };

export type BlockDiffEntry =
  | {
      status: typeof BLOCK_DIFF_STATUS.UNCHANGED | typeof BLOCK_DIFF_STATUS.MODIFIED;
      before: ContentBlock;
      after: ContentBlock;
    }
  | { status: typeof BLOCK_DIFF_STATUS.ADDED; after: ContentBlock }
  | { status: typeof BLOCK_DIFF_STATUS.REMOVED; before: ContentBlock };

export type WordDiffPart = {
  type: (typeof WORD_DIFF_TYPE)[keyof typeof WORD_DIFF_TYPE];
  text: string;
};

/** Above this, fall back to a whole replace instead of a quadratic diff. */
const MAX_DIFF_CELLS = 250_000;

const normalizeText = (value: string) => value.replace(/\s+/g, " ").trim();

const stripTags = (html: string) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

export const splitContentBlocks = (html: string): ContentBlock[] => {
  if (!html.trim()) return [];
  if (typeof DOMParser === "undefined") {
    return [{ id: null, html, text: normalizeText(stripTags(html)) }];
  }
  const document = new DOMParser().parseFromString(html, "text/html");
  const blocks: ContentBlock[] = [];
  document.body.childNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      blocks.push({
        id: element.getAttribute(AUTHORING_BLOCK_ID_ATTRIBUTE),
        html: element.outerHTML,
        text: normalizeText(element.textContent ?? ""),
      });
      return;
    }
    const text = normalizeText(node.textContent ?? "");
    if (text) blocks.push({ id: null, html: `<p>${text}</p>`, text });
  });
  return blocks;
};

export const findContentBlock = (html: string, blockId: string) =>
  splitContentBlocks(html).find((block) => block.id === blockId) ?? null;

export const applyBlockReplacements = (
  html: string,
  replacements: Array<{ blockId: string; html: string }>,
) => {
  if (replacements.length === 0 || typeof DOMParser === "undefined") return html;
  const document = new DOMParser().parseFromString(html, "text/html");
  replacements.forEach(({ blockId, html: replacement }) => {
    const target = Array.from(document.body.children).find(
      (element) => element.getAttribute(AUTHORING_BLOCK_ID_ATTRIBUTE) === blockId,
    );
    if (target) target.outerHTML = replacement;
    else document.body.insertAdjacentHTML("beforeend", replacement);
  });
  return document.body.innerHTML;
};

/** Compare content and formatting, excluding editor identity and positional bookkeeping. */
const canonicalBlockHtml = (html: string): string => {
  if (typeof DOMParser === "undefined") {
    return html.replace(
      /\s(?:data-authoring-block-id|data-block-index)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
      "",
    );
  }
  const document = new DOMParser().parseFromString(html, "text/html");
  document.body.querySelectorAll("*").forEach((element) => {
    element.removeAttribute(AUTHORING_BLOCK_ID_ATTRIBUTE);
    element.removeAttribute("data-block-index");
    // Attribute order is a serialization detail, not a learner-visible change.
    const attributes = Array.from(element.attributes).sort((left, right) =>
      left.name.localeCompare(right.name),
    );
    attributes.forEach(({ name }) => element.removeAttribute(name));
    attributes.forEach(({ name, value }) => element.setAttribute(name, value));
  });
  return document.body.innerHTML;
};

const sameBlock = (left: ContentBlock, right: ContentBlock) => {
  // A full lesson rewrite can regenerate IDs while preserving existing content.
  // Stable IDs anchor edits; different IDs must still allow content matching.
  if (left.id && right.id && left.id === right.id) return true;
  if (left.text || right.text) return left.text === right.text;
  return canonicalBlockHtml(left.html) === canonicalBlockHtml(right.html);
};

const lcsPairs = <T>(left: T[], right: T[], equal: (a: T, b: T) => boolean) => {
  const rows = left.length + 1;
  const columns = right.length + 1;
  const table = Array.from({ length: rows }, () => new Array<number>(columns).fill(0));
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      table[i][j] = equal(left[i], right[j])
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const pairs: Array<[number, number]> = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (equal(left[i], right[j])) {
      pairs.push([i, j]);
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) i += 1;
    else j += 1;
  }
  return pairs;
};

const wordSet = (text: string) => new Set(text.toLowerCase().split(/\s+/).filter(Boolean));

const similarity = (left: ContentBlock, right: ContentBlock) => {
  const leftWords = wordSet(left.text);
  const rightWords = wordSet(right.text);
  if (leftWords.size === 0 || rightWords.size === 0) return 0;
  let shared = 0;
  leftWords.forEach((word) => {
    if (rightWords.has(word)) shared += 1;
  });
  return shared / Math.max(leftWords.size, rightWords.size);
};

const blockChanged = (before: ContentBlock, after: ContentBlock) =>
  canonicalBlockHtml(before.html) !== canonicalBlockHtml(after.html);

export const diffContentBlocks = (beforeHtml: string, afterHtml: string): BlockDiffEntry[] => {
  const before = splitContentBlocks(beforeHtml);
  const after = splitContentBlocks(afterHtml);
  const pairs =
    before.length * after.length > MAX_DIFF_CELLS ? [] : lcsPairs(before, after, sameBlock);
  const entries: BlockDiffEntry[] = [];

  const pushGap = (removed: ContentBlock[], added: ContentBlock[]) => {
    const remainingAdded = [...added];
    removed.forEach((block) => {
      const matchIndex = remainingAdded.findIndex(
        (candidate) => similarity(block, candidate) >= 0.4,
      );
      if (matchIndex < 0) {
        entries.push({ status: BLOCK_DIFF_STATUS.REMOVED, before: block });
        return;
      }
      remainingAdded
        .slice(0, matchIndex)
        .forEach((candidate) =>
          entries.push({ status: BLOCK_DIFF_STATUS.ADDED, after: candidate }),
        );
      entries.push({
        status: blockChanged(block, remainingAdded[matchIndex])
          ? BLOCK_DIFF_STATUS.MODIFIED
          : BLOCK_DIFF_STATUS.UNCHANGED,
        before: block,
        after: remainingAdded[matchIndex],
      });
      remainingAdded.splice(0, matchIndex + 1);
    });
    remainingAdded.forEach((candidate) =>
      entries.push({ status: BLOCK_DIFF_STATUS.ADDED, after: candidate }),
    );
  };

  let beforeCursor = 0;
  let afterCursor = 0;
  pairs.forEach(([beforeIndex, afterIndex]) => {
    pushGap(before.slice(beforeCursor, beforeIndex), after.slice(afterCursor, afterIndex));
    const pair = { before: before[beforeIndex], after: after[afterIndex] };
    entries.push({
      status: blockChanged(pair.before, pair.after)
        ? BLOCK_DIFF_STATUS.MODIFIED
        : BLOCK_DIFF_STATUS.UNCHANGED,
      ...pair,
    });
    beforeCursor = beforeIndex + 1;
    afterCursor = afterIndex + 1;
  });
  pushGap(before.slice(beforeCursor), after.slice(afterCursor));
  return entries;
};

const mergeParts = (parts: WordDiffPart[]) =>
  parts.reduce<WordDiffPart[]>((merged, part) => {
    const last = merged.at(-1);
    if (last && last.type === part.type) last.text += part.text;
    else merged.push({ ...part });
    return merged;
  }, []);

export const diffWords = (beforeText: string, afterText: string): WordDiffPart[] => {
  if (beforeText === afterText)
    return beforeText ? [{ type: WORD_DIFF_TYPE.SAME, text: beforeText }] : [];
  const before = beforeText.match(/\S+\s*/g) ?? [];
  const after = afterText.match(/\S+\s*/g) ?? [];
  if (before.length * after.length > MAX_DIFF_CELLS) {
    return [
      ...(beforeText ? [{ type: WORD_DIFF_TYPE.REMOVED, text: beforeText }] : []),
      ...(afterText ? [{ type: WORD_DIFF_TYPE.ADDED, text: afterText }] : []),
    ];
  }
  const pairs = lcsPairs(before, after, (left, right) => left.trim() === right.trim());
  const parts: WordDiffPart[] = [];
  let beforeCursor = 0;
  let afterCursor = 0;
  const pushGap = (beforeEnd: number, afterEnd: number) => {
    const removed = before.slice(beforeCursor, beforeEnd).join("");
    const added = after.slice(afterCursor, afterEnd).join("");
    if (removed) parts.push({ type: WORD_DIFF_TYPE.REMOVED, text: removed });
    if (added) parts.push({ type: WORD_DIFF_TYPE.ADDED, text: added });
  };
  pairs.forEach(([beforeIndex, afterIndex]) => {
    pushGap(beforeIndex, afterIndex);
    const [beforeWord, afterWord] = [before[beforeIndex], after[afterIndex]];
    parts.push({
      type: WORD_DIFF_TYPE.SAME,
      text: afterWord.length >= beforeWord.length ? afterWord : beforeWord,
    });
    beforeCursor = beforeIndex + 1;
    afterCursor = afterIndex + 1;
  });
  pushGap(before.length, after.length);
  return mergeParts(parts);
};
