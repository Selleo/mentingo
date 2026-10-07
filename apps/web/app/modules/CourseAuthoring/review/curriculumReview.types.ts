import type {
  PROPOSAL_DECISION,
  REVIEW_CHANGE_KIND,
  REVIEW_DECISION,
  REVIEW_NODE_TYPE,
} from "./curriculumReview.constants";
import type { AuthoringOperation } from "../courseAuthoring.types";
import type { Chapter, Lesson } from "~/modules/Admin/EditCourse/EditCourse.types";

export type ReviewChangeKind = (typeof REVIEW_CHANGE_KIND)[keyof typeof REVIEW_CHANGE_KIND];
export type ChangedKind = Exclude<ReviewChangeKind, typeof REVIEW_CHANGE_KIND.UNCHANGED>;
export type ReviewDecision = (typeof REVIEW_DECISION)[keyof typeof REVIEW_DECISION];
export type ProposalDecision = (typeof PROPOSAL_DECISION)[keyof typeof PROPOSAL_DECISION];

export type ReviewProposal = {
  id: string;
  summary: string;
  rationale: string;
  warnings: string[];
  blockedQuality: boolean;
  decision: ProposalDecision;
  operationIds: string[];
  dependsOnProposalIds: string[];
  courseLevel: boolean;
};

export type ReviewLessonNode = {
  nodeType: typeof REVIEW_NODE_TYPE.LESSON;
  id: string;
  chapterId: string;
  title: string;
  previousTitle: string | null;
  lessonType: string;
  kind: ReviewChangeKind;
  movedFrom: { chapterId: string; position: number } | null;
  current: Lesson | null;
  operations: AuthoringOperation[];
  proposalIds: string[];
};

export type ReviewChapterNode = {
  nodeType: typeof REVIEW_NODE_TYPE.CHAPTER;
  id: string;
  title: string;
  previousTitle: string | null;
  kind: ReviewChangeKind;
  movedFrom: { position: number } | null;
  current: Chapter | null;
  operations: AuthoringOperation[];
  proposalIds: string[];
  lessons: ReviewLessonNode[];
  changeCounts: ReviewChangeCounts;
};

export type ReviewCourseNode = {
  nodeType: typeof REVIEW_NODE_TYPE.COURSE;
  id: string;
  title: string;
  kind: typeof REVIEW_CHANGE_KIND.EDITED;
  operations: AuthoringOperation[];
  proposalIds: string[];
};

export type ReviewNode = ReviewChapterNode | ReviewLessonNode | ReviewCourseNode;

export type ReviewChangeCounts = Record<ChangedKind, number>;

export type ReviewChange = {
  key: string;
  node: ReviewNode;
};

export type CurriculumReviewModel = {
  course: ReviewCourseNode | null;
  chapters: ReviewChapterNode[];
  changes: ReviewChange[];
  counts: ReviewChangeCounts;
};

export type CurriculumReviewMarker = {
  kind: ReviewChangeKind;
  decision: ReviewDecision;
  previousTitle: string | null;
  note: string | null;
};

/** Lets the native curriculum list render review markers without owning review state. */
export type CurriculumReviewDecorations = {
  chapter: (chapterId: string) => CurriculumReviewMarker | undefined;
  lesson: (lessonId: string) => CurriculumReviewMarker | undefined;
  openChapterId: string | null;
};
