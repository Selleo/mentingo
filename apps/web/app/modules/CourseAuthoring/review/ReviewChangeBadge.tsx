import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

import { REVIEW_CHANGE_KIND } from "./curriculumReview.constants";

import type {
  ChangedKind,
  CurriculumReviewMarker,
  ReviewChangeKind,
} from "./curriculumReview.types";

const TONE: Record<ChangedKind, { dot: string; text: string; card: string }> = {
  [REVIEW_CHANGE_KIND.ADDED]: {
    dot: "bg-success-500",
    text: "text-success-700",
    card: "",
  },
  [REVIEW_CHANGE_KIND.EDITED]: {
    dot: "bg-warning-500",
    text: "text-warning-800",
    card: "",
  },
  [REVIEW_CHANGE_KIND.REMOVED]: {
    dot: "bg-error-500",
    text: "text-error-700",
    card: "border-dashed",
  },
  [REVIEW_CHANGE_KIND.MOVED]: {
    dot: "bg-primary-500",
    text: "text-primary-700",
    card: "",
  },
};

export const reviewAccentClass = (kind: ReviewChangeKind | undefined) =>
  kind && kind !== REVIEW_CHANGE_KIND.UNCHANGED ? TONE[kind].card : undefined;

export const ReviewKindBadge = ({ kind, className }: { kind: ChangedKind; className?: string }) => {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        "details-md inline-flex shrink-0 items-center gap-1.5",
        TONE[kind].text,
        className,
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", TONE[kind].dot)} />
      {t(`courseAuthoring.reviewMode.kind.${kind}`)}
    </span>
  );
};

export const ReviewCardMarker = ({ marker }: { marker: CurriculumReviewMarker | undefined }) => {
  if (!marker || marker.kind === REVIEW_CHANGE_KIND.UNCHANGED) return null;
  return <ReviewKindBadge kind={marker.kind} />;
};
