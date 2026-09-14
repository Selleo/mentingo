import { AI_THREAD_STATUSES } from "@repo/shared";
import { Archive, CheckCircle2, Clock3 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

const presentation = {
  [AI_THREAD_STATUSES.ACTIVE]: { variant: "inProgress", icon: Clock3 },
  [AI_THREAD_STATUSES.COMPLETED]: { variant: "success", icon: CheckCircle2 },
  [AI_THREAD_STATUSES.ARCHIVED]: { variant: "notStarted", icon: Archive },
} as const;

export function ConversationStatus({
  status,
  compact = false,
}: {
  status: keyof typeof presentation;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const { variant, icon: StatusIcon } = presentation[status];
  if (compact)
    return (
      <span
        className={cn("inline-flex items-center gap-1 whitespace-nowrap text-xs", {
          "text-warning-800": status === AI_THREAD_STATUSES.ACTIVE,
          "text-success-700": status === AI_THREAD_STATUSES.COMPLETED,
          "text-neutral-500": status === AI_THREAD_STATUSES.ARCHIVED,
        })}
      >
        <StatusIcon className="size-3.5" aria-hidden="true" />
        {t(`aiConversations.statuses.${status}`)}
      </span>
    );
  return (
    <Badge variant={variant} className="w-max whitespace-nowrap">
      <StatusIcon className="size-4" aria-hidden="true" />
      {t(`aiConversations.statuses.${status}`)}
    </Badge>
  );
}
