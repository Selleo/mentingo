import { useTranslation } from "react-i18next";

import { Badge } from "~/components/ui/badge";

type LearningPathStatus = "draft" | "published" | "private";
type LearningPathProgress = "not_started" | "in_progress" | "completed" | "blocked";

type LearningPathStatusBadgeProps = {
  status: LearningPathStatus | LearningPathProgress;
};

const statusVariant = {
  draft: "draft",
  published: "success",
  private: "secondary",
  not_started: "notStarted",
  in_progress: "inProgress",
  completed: "success",
  blocked: "blocked",
} as const;

export function LearningPathStatusBadge({ status }: LearningPathStatusBadgeProps) {
  const { t } = useTranslation();

  return (
    <Badge variant={statusVariant[status]} className="w-max">
      {t(`learningPathsView.status.${status}`)}
    </Badge>
  );
}
