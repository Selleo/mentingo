import { AI_THREAD_STATUSES } from "@repo/shared";
import { Archive, CheckCircle2, Clock3 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "~/components/ui/badge";

const presentation = {
  [AI_THREAD_STATUSES.ACTIVE]: { variant: "inProgress", icon: Clock3 },
  [AI_THREAD_STATUSES.COMPLETED]: { variant: "success", icon: CheckCircle2 },
  [AI_THREAD_STATUSES.ARCHIVED]: { variant: "notStarted", icon: Archive },
} as const;

export function ConversationStatus({ status }: { status: keyof typeof presentation }) {
  const { t } = useTranslation();
  const { variant, icon: StatusIcon } = presentation[status];
  return (
    <Badge variant={variant} className="w-max whitespace-nowrap">
      <StatusIcon className="size-4" aria-hidden="true" />
      {t(`aiConversations.statuses.${status}`)}
    </Badge>
  );
}
