import {
  COURSE_PROGRESS_STATUSES,
  LEARNING_PATH_PROGRESS_STATUSES,
  LEARNING_PATH_STATUSES,
  type CourseProgressStatus,
  type LearningPathProgressStatus,
  type LearningPathStatus,
} from "@repo/shared";
import { useTranslation } from "react-i18next";

import { Badge } from "~/components/ui/badge";

type LearningPathStatusBadgeValue =
  | LearningPathStatus
  | LearningPathProgressStatus
  | CourseProgressStatus;

type LearningPathStatusBadgeProps = {
  status: LearningPathStatusBadgeValue;
};

const statusVariant = {
  [LEARNING_PATH_STATUSES.DRAFT]: "draft",
  [LEARNING_PATH_STATUSES.PUBLISHED]: "success",
  [LEARNING_PATH_STATUSES.PRIVATE]: "secondary",
  [LEARNING_PATH_PROGRESS_STATUSES.NOT_STARTED]: "notStarted",
  [LEARNING_PATH_PROGRESS_STATUSES.IN_PROGRESS]: "inProgress",
  [LEARNING_PATH_PROGRESS_STATUSES.COMPLETED]: "success",
  [COURSE_PROGRESS_STATUSES.BLOCKED]: "blocked",
} as const satisfies Record<LearningPathStatusBadgeValue, string>;

export function LearningPathStatusBadge({ status }: LearningPathStatusBadgeProps) {
  const { t } = useTranslation();

  return (
    <Badge variant={statusVariant[status]} className="w-max">
      {t(`learningPathsView.status.${status}`)}
    </Badge>
  );
}
