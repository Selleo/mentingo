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
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h4 className="h4">{t("automationView.title")}</h4>
        <p className="mt-2 text-sm text-neutral-600">{t("automationView.description")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={onCreate} data-testid="automation-page-create-button">
          <Plus className="mr-2 size-4" />
          {t("automationView.createAutomation")}
        </Button>
      </div>
    </div>
  );
};
