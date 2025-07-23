import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";

import { HoverCard, HoverCardContent, HoverCardTrigger } from "~/components/ui/hover-card";

export function GlobalSetting() {
  const { t } = useTranslation();
  return (
    <>
      <HoverCard>
        <HoverCardTrigger className="hover:cursor-pointer">
          <Globe className="text-orange-500" />
        </HoverCardTrigger>
        <HoverCardContent>{t("adminPreferences.globalActionWarning")}</HoverCardContent>
      </HoverCard>
    </>
  );
}
