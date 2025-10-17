import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useUpdateEnforceSSO } from "~/api/mutations/admin/useUpdateEnforceSSO";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Switch } from "~/components/ui/switch";

interface SSOEnforceSwitchProps {
  enforceSSO: boolean;
}

export default function SSOEnforceSwitch({ enforceSSO }: SSOEnforceSwitchProps) {
  const { t } = useTranslation();
  const [isChecked, setIsChecked] = useState(enforceSSO || false);

  const { mutate: updateEnforceSSO, isPending } = useUpdateEnforceSSO();

  const toggleSwitch = () => setIsChecked((prev) => !prev);

  const saveSSOEnforcement = () => {
    if (isChecked !== enforceSSO) {
      updateEnforceSSO();
    }
  };

  return (
    <Card id="sso-enforcement">
      <CardHeader>
        <CardTitle className="h5">{t("ssoEnforcementView.header")}</CardTitle>
        <CardDescription className="body-lg-md">
          {t("ssoEnforcementView.subHeader")}
        </CardDescription>
      </CardHeader>
      <CardContent className="body-sm-md flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
        <p className="md:w-3/4">{t("ssoEnforcementView.description")}</p>
        <div className="group inline-flex items-center gap-2">
          <span className="flex-1 text-right details">
            {t("ssoEnforcementView.switch.disabled")}
          </span>
          <Switch checked={isChecked} onCheckedChange={toggleSwitch} />
          <span className="flex-1 text-left details">{t("ssoEnforcementView.switch.enabled")}</span>
        </div>
      </CardContent>
      <CardFooter className="border-t px-6 py-4">
        <Button disabled={isPending} type="submit" onClick={saveSSOEnforcement}>
          {t("common.button.save")}
        </Button>
      </CardFooter>
    </Card>
  );
}
