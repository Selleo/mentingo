import { ALLOWED_QA_SETTINGS } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { useChangeQASetting } from "~/api/mutations/admin/useChangeQASetting";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { SettingItem } from "~/modules/Dashboard/Settings/components/SettingItem";

import { QA_SETTINGS_HANDLES } from "../../../../../../e2e/data/qa/handles";

import type { GlobalSettings } from "../../types";

interface QAPreferencesProps {
  globalSettings: GlobalSettings;
}

export default function QAPreferences({ globalSettings }: QAPreferencesProps) {
  const { t } = useTranslation();
  const { mutate: updateQAPreference } = useChangeQASetting();

  return (
    <Card id="qa-preferences" data-testid={QA_SETTINGS_HANDLES.PREFERENCES_CARD}>
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
          testId={QA_SETTINGS_HANDLES.ENABLED_SWITCH}
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
          testId={QA_SETTINGS_HANDLES.PUBLIC_SWITCH}
        />
      </CardContent>
    </Card>
  );
}
