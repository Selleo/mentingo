import { Badge } from "~/components/ui/badge";

import type { IconName } from "~/types/shared";

type ProgressBadgeProps = {
  progress: "completed" | "inProgress" | "notStarted" | "blocked";
  className?: string;
};

type ProgressConfig = {
  [key in "completed" | "inProgress" | "notStarted" | "blocked"]: {
    variant: "successFilled" | "inProgressFilled" | "notStartedFilled" | "blockedFilled";
    icon: IconName;
    label: string;
  };
};

export const ProgressBadge = ({ progress, className }: ProgressBadgeProps) => {
  const progressConfig: ProgressConfig = {
    completed: {
      variant: "successFilled",
      icon: "InputRoundedMarkerSuccess",
      label: "Completed",
    },
    inProgress: {
      variant: "inProgressFilled",
      icon: "InProgress",
      label: "In Progress",
    },
    notStarted: {
      variant: "notStartedFilled",
      icon: "NotStartedRounded",
      label: "Not Started",
    },
    blocked: {
      variant: "blockedFilled",
      icon: "Blocked",
      label: "Blocked",
    },
  };

  const { variant, icon, label } = progressConfig[progress];

  return (
    <Badge
      variant={variant}
      icon={icon}
      iconClasses="size-4"
      {...(Boolean(className) && { className })}
    >
      {label}
    </Badge>
  );
};
