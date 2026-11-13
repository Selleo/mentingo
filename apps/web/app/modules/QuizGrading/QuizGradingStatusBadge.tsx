import { ASSESSMENT_ANSWER_GRADING_STATUSES } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { Badge } from "~/components/ui/badge";

import type { QuizGradingStatus } from "./quizGrading.utils";

export function QuizGradingStatusBadge({ status }: { status: QuizGradingStatus }) {
  const { t } = useTranslation();

  return (
    <Badge
      variant={
        status === ASSESSMENT_ANSWER_GRADING_STATUSES.GRADED ? "successFilled" : "inProgress"
      }
    >
      {t(`quizGrading.status.${status}`)}
    </Badge>
  );
}
