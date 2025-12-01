import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useUpdateConfigWarningDismissed } from "~/api/mutations/admin/useUpdateConfigWarningDismissed";
import { Icon } from "~/components/Icon";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";

import type { GetIsConfigSetupResponse } from "~/api/generated-api";

interface EnvSetupDialogProps {
  data: GetIsConfigSetupResponse["data"];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EnvSetupDialog({ data, isOpen, onOpenChange }: EnvSetupDialogProps) {
  const { t } = useTranslation();

  const { mutate: updateDismissed } = useUpdateConfigWarningDismissed();

  const handleDismiss = () => updateDismissed(true);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto" noCloseButton>
        <DialogTitle className="h4 text-2xl w-full flex items-center justify-between">
          {t("environmentConfigurationView.dialog.title")}
          <Button
            variant="outline"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="text-neutral-300 hover:text-primary-500"
          >
            <Icon name="X" className="size-3" />
          </Button>
        </DialogTitle>

        <div className="space-y-6 py-4 flex flex-col items-end">
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 h6">
                <CheckCircle2 className="size-5 text-success-500" />
                {t("environmentConfigurationView.dialog.fullyConfigured")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.fullyConfigured.length > 0 ? (
                  data.fullyConfigured.map((service) => (
                    <div key={service} className="flex items-start gap-3">
                      <Badge
                        variant="outline"
                        className="body-sm px-2 py-1 border border-success-500"
                      >
                        {t(`environmentConfigurationView.dialog.serviceNames.${service}`)}
                      </Badge>
                      <p className="body-sm text-muted-foreground pt-0.5">
                        {t(`environmentConfigurationView.dialog.serviceDescriptions.${service}`)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="body-sm text-muted-foreground">
                    {t("environmentConfigurationView.dialog.noFullyConfigured")}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {data.partiallyConfigured.length > 0 && (
            <Card className="w-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 h6">
                  <AlertCircle className="size-5 text-warning-500 " />
                  {t("environmentConfigurationView.dialog.partiallyConfigured")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.partiallyConfigured.map(({ service, missingKeys }) => (
                    <div key={service} className="space-y-2">
                      <div>
                        <p className="body-sm font-semibold">
                          {t(`environmentConfigurationView.dialog.serviceNames.${service}`)}
                        </p>
                        <p className="body-sm text-muted-foreground pt-0.5">
                          {t(`environmentConfigurationView.dialog.serviceDescriptions.${service}`)}
                        </p>
                      </div>
                      {missingKeys.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {missingKeys.map((key) => (
                            <Badge
                              key={key}
                              variant="outline"
                              className="body-sm px-2 py-1 border border-warning-500"
                            >
                              {key}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {data.notConfigured.length > 0 && (
            <Card className="w-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 h6">
                  <Info className="size-5 text-blue-500" />
                  {t("environmentConfigurationView.dialog.youMightWantToSetThisUp")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.notConfigured.map(({ service, missingKeys }) => (
                    <div key={service} className="space-y-2">
                      <div>
                        <p className="body-sm font-semibold ">
                          {t(`environmentConfigurationView.dialog.serviceNames.${service}`)}
                        </p>
                        <p className="body-sm text-muted-foreground pt-0.5">
                          {t(`environmentConfigurationView.dialog.serviceDescriptions.${service}`)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {missingKeys.map((key) => (
                          <Badge
                            key={key}
                            variant="outline"
                            className="body-sm px-2 py-1 border border-blue-500"
                          >
                            {key}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Button
            onClick={() => {
              handleDismiss();
              onOpenChange(false);
            }}
          >
            <Icon name="X" className="size-2.5 mr-2" />
            {t("environmentConfigurationView.dialog.dismissWarning")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
