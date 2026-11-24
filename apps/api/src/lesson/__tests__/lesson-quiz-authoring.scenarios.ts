import { ASSESSMENT_QUESTION_TYPES } from "@repo/shared";

export const DRAG_AND_DROP_PLACEMENT_CASES = [
  { firstPlacement: "Report", secondPlacement: "Continue", expectedScore: 0 },
  { firstPlacement: "Report", secondPlacement: "Stop", expectedScore: 0 },
  { firstPlacement: "Stop", secondPlacement: "Report", expectedScore: 100 },
];

export const QUESTION_SHAPES = {
  CHOICE: "choice",
  SCALE: "scale",
  BLANKS: "blanks",
  OPEN_TEXT: "open text",
  MATCHING: "matching",
} as const;

export type QuestionShape = (typeof QUESTION_SHAPES)[keyof typeof QUESTION_SHAPES];

export const QUESTION_TYPE_CASES = [
  { type: ASSESSMENT_QUESTION_TYPES.SINGLE_CHOICE, shape: QUESTION_SHAPES.CHOICE },
  { type: ASSESSMENT_QUESTION_TYPES.MULTIPLE_CHOICE, shape: QUESTION_SHAPES.CHOICE },
  { type: ASSESSMENT_QUESTION_TYPES.TRUE_OR_FALSE, shape: QUESTION_SHAPES.CHOICE },
  { type: ASSESSMENT_QUESTION_TYPES.PHOTO_QUESTION_SINGLE_CHOICE, shape: QUESTION_SHAPES.CHOICE },
  { type: ASSESSMENT_QUESTION_TYPES.PHOTO_QUESTION_MULTIPLE_CHOICE, shape: QUESTION_SHAPES.CHOICE },
  { type: ASSESSMENT_QUESTION_TYPES.FILL_IN_THE_BLANKS_TEXT, shape: QUESTION_SHAPES.BLANKS },
  { type: ASSESSMENT_QUESTION_TYPES.FILL_IN_THE_BLANKS_DND, shape: QUESTION_SHAPES.BLANKS },
  { type: ASSESSMENT_QUESTION_TYPES.BRIEF_RESPONSE, shape: QUESTION_SHAPES.OPEN_TEXT },
  { type: ASSESSMENT_QUESTION_TYPES.DETAILED_RESPONSE, shape: QUESTION_SHAPES.OPEN_TEXT },
  { type: ASSESSMENT_QUESTION_TYPES.SCALE_1_5, shape: QUESTION_SHAPES.SCALE },
  { type: ASSESSMENT_QUESTION_TYPES.MATCHING, shape: QUESTION_SHAPES.MATCHING },
];

export const BASE_FEEDBACK_RANGES = [
  { minPercent: 50, maxPercent: 100, message: "High" },
  { minPercent: 0, maxPercent: 49, message: "Low" },
];
