import { useTranslation } from "react-i18next";

import { Badge } from "~/components/ui/badge";

import type { HTMLAttributes } from "react";
import type { IconName } from "~/types/shared";

export type ProgressBadgeKey =
  | "completed"
  | "inProgress"
  | "notStarted"
  | "blocked"
  | "awaitingReview"
  | "failed";

// Shared mapping from the lesson `status` union (snake_case) to the ProgressBadge `progress` key,
// used by both the lesson sidebar and the course overview so the status stays in sync across them.
export const LESSON_STATUS_TO_PROGRESS = {
  completed: "completed",
  in_progress: "inProgress",
  not_started: "notStarted",
  blocked: "blocked",
  awaiting_review: "awaitingReview",
  failed: "failed",
} as const satisfies Record<string, ProgressBadgeKey>;

type ProgressBadgeProps = HTMLAttributes<HTMLDivElement> & {
  progress: ProgressBadgeKey;
  /** Render icon only (keeping the label as screen-reader text) for dense layouts like the lesson sidebar. */
  hideLabel?: boolean;
};

type ProgressConfig = {
  [key in ProgressBadgeKey]: {
    variant:
      | "successFilled"
      | "inProgressFilled"
      | "notStartedFilled"
      | "blockedFilled"
      | "failedFilled";
    icon: IconName;
    label: string;
  };
};

export const ProgressBadge = ({
  progress,
  className,
  hideLabel = false,
  ...props
}: ProgressBadgeProps) => {
  const { t } = useTranslation();

  const progressConfig: ProgressConfig = {
    completed: {
      variant: "successFilled",
      icon: "InputRoundedMarkerSuccess",
      label: t("progressBadge.completed"),
    },
    inProgress: {
      variant: "inProgressFilled",
      icon: "InProgress",
      label: t("progressBadge.inProgress"),
    },
    notStarted: {
      variant: "notStartedFilled",
      icon: "NotStartedRounded",
      label: t("progressBadge.notStarted"),
    },
    blocked: {
      variant: "blockedFilled",
      icon: "Blocked",
      label: t("progressBadge.blocked"),
    },
    awaitingReview: {
      variant: "inProgressFilled",
      icon: "InProgress",
      label: t("progressBadge.awaitingReview"),
    },
    failed: {
      variant: "failedFilled",
      icon: "InputRoundedMarkerError",
      label: t("progressBadge.failed"),
    },
  };

  const { variant, icon, label } = progressConfig[progress];

  if (hideLabel) {
    return (
      <>
        <Badge
          variant="icon"
          icon={icon}
          iconClasses="w-6 h-auto shrink-0"
          {...(Boolean(className) && { className })}
          {...props}
        />
        <span className="sr-only">{label}</span>
      </>
    );
  }

  return (
    <Badge
      variant={variant}
      icon={icon}
      iconClasses="size-4"
      {...(Boolean(className) && { className })}
      {...props}
    >
      {label}
    </Badge>
  );
};
