import { useTranslation } from "react-i18next";

import { useResetOnboarding } from "~/api/mutations/useResetOnboarding";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "~/components/ui/card";

export function ResetOnboarding() {
  const { t } = useTranslation();

  const { mutate: resetOnboarding, isPending: isResetting } = useResetOnboarding();

  const handleResetOnboarding = () => resetOnboarding();

  return (
    <Card id="reset-onboarding">
      <CardContent className="p-6 flex justify-between items-end">
        <div className="space-y-2">
          <CardTitle className="h5">{t("resetOnboarding.header")}</CardTitle>
          <CardDescription className="body-lg-md">{t("resetOnboarding.subHeader")}</CardDescription>
        </div>
        <Button variant="outline" onClick={handleResetOnboarding} disabled={isResetting}>
          {t("resetOnboarding.button.reset")}
        </Button>
      </CardContent>
    </Card>
  );
}
