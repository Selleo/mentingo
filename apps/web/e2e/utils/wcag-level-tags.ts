export type WcagLevel = "A" | "AA" | "AAA";

const WCAG_A_TAGS = ["wcag2a", "wcag21a"];
const WCAG_AA_TAGS = [...WCAG_A_TAGS, "wcag2aa", "wcag21aa", "wcag22aa"];

/** Cumulative axe tags per conformance level; axe-core ships no wcag22a and only `wcag2aaa` for AAA. */
export const WCAG_LEVEL_TAGS: Record<WcagLevel, string[]> = {
  A: WCAG_A_TAGS,
  AA: WCAG_AA_TAGS,
  AAA: [...WCAG_AA_TAGS, "wcag2aaa"],
};
