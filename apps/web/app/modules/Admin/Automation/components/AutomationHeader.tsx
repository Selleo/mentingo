import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";

import type { FC } from "react";

interface AutomationHeaderProps {
  onCreate: () => void;
}

export const AutomationHeader: FC<AutomationHeaderProps> = ({ onCreate }) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t("automationView.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("automationView.description")}</p>
      </div>
      <Button onClick={onCreate} data-testid="automation-page-create-button">
        <Plus className="mr-2 size-4" />
        {t("automationView.createAutomation")}
      </Button>
    </div>
  );
};
