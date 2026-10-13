import { useTranslation } from "react-i18next";

import { Badge } from "~/components/ui/badge";

import type { ComponentProps } from "react";

type BadgeVariant = ComponentProps<typeof Badge>["variant"];

const CAMPAIGN_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  scheduled: "inProgress",
  completed: "success",
  cancelled: "blocked",
};

const COURSE_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  not_enrolled: "blocked",
  not_started: "notStarted",
  in_progress: "inProgress",
  completed: "success",
};

export function PhishingStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();

  return (
    <Badge className="w-fit" variant={CAMPAIGN_STATUS_VARIANTS[status] ?? "default"}>
      {t(`phishing.status.${status}`)}
    </Badge>
  );
}

export function PhishingCourseStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();

  return (
    <Badge className="w-fit" variant={COURSE_STATUS_VARIANTS[status] ?? "default"}>
      {t(`phishing.courseStatuses.${status}`, { defaultValue: status })}
    </Badge>
  );
}
