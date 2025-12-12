import { ALLOWED_QA_SETTINGS } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { useChangeQASetting } from "~/api/mutations/admin/useChangeQASetting";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { SettingItem } from "~/modules/Dashboard/Settings/components/SettingItem";

import type { GlobalSettings } from "../../types";

interface QAPreferencesProps {
  globalSettings: GlobalSettings;
}

export default function QAPreferences({ globalSettings }: QAPreferencesProps) {
  const { t } = useTranslation();
  const { mutate: updateQAPreference } = useChangeQASetting();
  t("qaPreferences.tooltip.disabled");

  return (
    <Card id="qa-preferences">
      <CardHeader>
        <CardTitle className="h5">{t("qaPreferences.header")}</CardTitle>
        <CardDescription className="body-lg-md">{t("qaPreferences.subHeader")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SettingItem
          id="qa-enabled"
          label={t(`qaPreferences.settings.qaEnabled.label`)}
          description={t(`qaPreferences.settings.qaEnabled.description`)}
          checked={globalSettings.QAEnabled}
          onCheckedChange={() => updateQAPreference(ALLOWED_QA_SETTINGS.QA_ENABLED)}
        />
        <SettingItem
          id="qa-public"
          label={t(`qaPreferences.settings.qaPublic.label`)}
          description={t(`qaPreferences.settings.qaPublic.description`)}
          checked={globalSettings.unregisteredUserQAAccessibility}
          onCheckedChange={() =>
            updateQAPreference(ALLOWED_QA_SETTINGS.UNREGISTERED_USER_QA_ACCESSIBILITY)
          }
          disabled={!globalSettings.QAEnabled}
          tooltipTranslationKey="qaPreferences.tooltip.disabled"
        />
      </CardContent>
    </Card>
  );
}
