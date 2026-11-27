import { WCAG_LEVEL_TAGS } from "../utils/wcag-level-tags";

export const WCAG_LEVEL = {
  A: "A",
  AA: "AA",
} as const;

export type WcagCriterionLevel = (typeof WCAG_LEVEL)[keyof typeof WCAG_LEVEL];

/**
 * How far automation can decide a criterion:
 * - `decisive`: the automated checks decide it (only the document language, and 4.1.1, which the
 *   WCAG 2.1 errata declare always satisfied for HTML).
 * - `partial`: automation finds some failures but a pass still needs a human.
 * - `manual`: no reliable automated check; a human must test it.
 */
export const AUTOMATION_LEVEL = {
  DECISIVE: "decisive",
  PARTIAL: "partial",
  MANUAL: "manual",
} as const;

export type AutomationLevel = (typeof AUTOMATION_LEVEL)[keyof typeof AUTOMATION_LEVEL];

export type WcagCriterion = {
  id: string;
  level: WcagCriterionLevel;
  title: string;
  automation: AutomationLevel;
  /** Treated as met without testing (WCAG 2.1 errata for 4.1.1 Parsing). */
  alwaysSatisfied?: boolean;
};

/** The 50 success criteria of WCAG 2.1 levels A and AA. */
export const WCAG21_AA_CRITERIA: WcagCriterion[] = [
  { id: "1.1.1", level: "A", title: "Non-text Content", automation: "partial" },
  {
    id: "1.2.1",
    level: "A",
    title: "Audio-only and Video-only (Prerecorded)",
    automation: "manual",
  },
  { id: "1.2.2", level: "A", title: "Captions (Prerecorded)", automation: "partial" },
  {
    id: "1.2.3",
    level: "A",
    title: "Audio Description or Media Alternative (Prerecorded)",
    automation: "manual",
  },
  { id: "1.2.4", level: "AA", title: "Captions (Live)", automation: "manual" },
  { id: "1.2.5", level: "AA", title: "Audio Description (Prerecorded)", automation: "manual" },
  { id: "1.3.1", level: "A", title: "Info and Relationships", automation: "partial" },
  { id: "1.3.2", level: "A", title: "Meaningful Sequence", automation: "manual" },
  { id: "1.3.3", level: "A", title: "Sensory Characteristics", automation: "manual" },
  { id: "1.3.4", level: "AA", title: "Orientation", automation: "partial" },
  { id: "1.3.5", level: "AA", title: "Identify Input Purpose", automation: "partial" },
  { id: "1.4.1", level: "A", title: "Use of Color", automation: "partial" },
  { id: "1.4.2", level: "A", title: "Audio Control", automation: "partial" },
  { id: "1.4.3", level: "AA", title: "Contrast (Minimum)", automation: "partial" },
  { id: "1.4.4", level: "AA", title: "Resize Text", automation: "partial" },
  { id: "1.4.5", level: "AA", title: "Images of Text", automation: "manual" },
  { id: "1.4.10", level: "AA", title: "Reflow", automation: "partial" },
  { id: "1.4.11", level: "AA", title: "Non-text Contrast", automation: "manual" },
  { id: "1.4.12", level: "AA", title: "Text Spacing", automation: "partial" },
  { id: "1.4.13", level: "AA", title: "Content on Hover or Focus", automation: "manual" },
  { id: "2.1.1", level: "A", title: "Keyboard", automation: "partial" },
  { id: "2.1.2", level: "A", title: "No Keyboard Trap", automation: "partial" },
  { id: "2.1.4", level: "A", title: "Character Key Shortcuts", automation: "manual" },
  { id: "2.2.1", level: "A", title: "Timing Adjustable", automation: "partial" },
  { id: "2.2.2", level: "A", title: "Pause, Stop, Hide", automation: "partial" },
  { id: "2.3.1", level: "A", title: "Three Flashes or Below Threshold", automation: "manual" },
  { id: "2.4.1", level: "A", title: "Bypass Blocks", automation: "partial" },
  { id: "2.4.2", level: "A", title: "Page Titled", automation: "partial" },
  { id: "2.4.3", level: "A", title: "Focus Order", automation: "manual" },
  { id: "2.4.4", level: "A", title: "Link Purpose (In Context)", automation: "partial" },
  { id: "2.4.5", level: "AA", title: "Multiple Ways", automation: "manual" },
  { id: "2.4.6", level: "AA", title: "Headings and Labels", automation: "manual" },
  { id: "2.4.7", level: "AA", title: "Focus Visible", automation: "partial" },
  { id: "2.5.1", level: "A", title: "Pointer Gestures", automation: "manual" },
  { id: "2.5.2", level: "A", title: "Pointer Cancellation", automation: "manual" },
  { id: "2.5.3", level: "A", title: "Label in Name", automation: "partial" },
  { id: "2.5.4", level: "A", title: "Motion Actuation", automation: "manual" },
  { id: "3.1.1", level: "A", title: "Language of Page", automation: "decisive" },
  { id: "3.1.2", level: "AA", title: "Language of Parts", automation: "partial" },
  { id: "3.2.1", level: "A", title: "On Focus", automation: "manual" },
  { id: "3.2.2", level: "A", title: "On Input", automation: "manual" },
  { id: "3.2.3", level: "AA", title: "Consistent Navigation", automation: "manual" },
  { id: "3.2.4", level: "AA", title: "Consistent Identification", automation: "manual" },
  { id: "3.3.1", level: "A", title: "Error Identification", automation: "manual" },
  { id: "3.3.2", level: "A", title: "Labels or Instructions", automation: "partial" },
  { id: "3.3.3", level: "AA", title: "Error Suggestion", automation: "manual" },
  {
    id: "3.3.4",
    level: "AA",
    title: "Error Prevention (Legal, Financial, Data)",
    automation: "manual",
  },
  {
    id: "4.1.1",
    level: "A",
    title: "Parsing",
    automation: "decisive",
    alwaysSatisfied: true,
  },
  { id: "4.1.2", level: "A", title: "Name, Role, Value", automation: "partial" },
  { id: "4.1.3", level: "AA", title: "Status Messages", automation: "manual" },
];

/**
 * Axe tags of the audit: the same WCAG A/AA tags as the E2E accessibility specs, plus best
 * practices. Only WCAG 2.1 A/AA rules count towards the score; the rest is reported as extra.
 */
export const AUDIT_AXE_TAGS = [...WCAG_LEVEL_TAGS.AA, "best-practice"];

/** Turns an axe tag such as `wcag1410` into `1.4.10`; returns null for non-criterion tags. */
export const criterionIdFromAxeTag = (tag: string) => {
  const criterionTag = /^wcag(\d)(\d)(\d+)$/.exec(tag);
  if (!criterionTag) return null;

  const [, principle, guideline, criterion] = criterionTag;
  return `${principle}.${guideline}.${criterion}`;
};
