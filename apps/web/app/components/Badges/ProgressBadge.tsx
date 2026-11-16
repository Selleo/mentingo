import { useTranslation } from "react-i18next";

import { Badge } from "~/components/ui/badge";

import type { HTMLAttributes } from "react";
import type { IconName } from "~/types/shared";

type ProgressBadgeProps = HTMLAttributes<HTMLDivElement> & {
  progress: "completed" | "inProgress" | "notStarted" | "blocked" | "awaitingReview";
  className?: string;
  /** Render icon only (keeping the label as screen-reader text) for dense layouts like the lesson sidebar. */
  hideLabel?: boolean;
};

type ProgressConfig = {
  [key in ProgressBadgeProps["progress"]]: {
    variant: "successFilled" | "inProgressFilled" | "notStartedFilled" | "blockedFilled";
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
