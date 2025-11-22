import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useConfigurationState } from "~/api/queries/admin/useConfigurationState";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { EnvSetupDialog } from "~/modules/Dashboard/components/ConfigurationDialog";

export function ConfigurationStatus() {
  const { t } = useTranslation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: configurationState, isLoading } = useConfigurationState({
    enabled: true,
  });

  const showWarning =
    configurationState && configurationState.hasIssues && !configurationState.isWarningDismissed;

  return (
    <>
      <Card
        id="environment-configuration"
        className={showWarning ? "border-warning-500 border-2" : undefined}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="h5">{t("environmentConfigurationView.header")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="body-sm-md flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <p className="md:w-3/4">{t("environmentConfigurationView.description")}</p>
          <Button onClick={() => setIsDialogOpen(true)} disabled={isLoading} className="shrink-0">
            {isLoading
              ? t("environmentConfigurationView.button.loading")
              : t("environmentConfigurationView.button.viewStatus")}
          </Button>
        </CardContent>
      </Card>

      {configurationState && (
        <EnvSetupDialog
          data={configurationState}
          isOpen={isDialogOpen}
          onOpenChange={setIsDialogOpen}
        />
      )}
    </>
  );
}
