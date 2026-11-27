import { useTranslation } from "react-i18next";

import { Badge } from "~/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";

import { GROUPS_PAGE_HANDLES } from "../../../../../e2e/data/groups/handles";

export function DirectorySyncedGroupBadge() {
  const { t } = useTranslation();

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span data-testid={GROUPS_PAGE_HANDLES.DIRECTORY_SYNCED_BADGE}>
            <Badge variant="secondary" className="whitespace-nowrap">
              {t("directorySync.group.syncedBadge")}
            </Badge>
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          {t("directorySync.group.syncedTooltip")}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
