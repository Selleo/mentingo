import { ALLOWED_COHORT_SETTINGS } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { useChangeCohortSetting } from "~/api/mutations/admin/useChangeCohortSetting";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { SettingItem } from "~/modules/Dashboard/Settings/components/SettingItem";

import type { GlobalSettings } from "../../types";

interface CohortLearningPreferencesProps {
  globalSettings: GlobalSettings;
}

export default function CohortLearningPreferences({
  globalSettings,
}: CohortLearningPreferencesProps) {
  const { t } = useTranslation();
  const { mutate: updateCohortSetting } = useChangeCohortSetting();

  const isEnabled = Boolean(
    (globalSettings as unknown as Record<string, boolean>).cohortLearningEnabled,
  );

  return (
    <Card id="cohort-learning-preferences">
      <CardHeader>
        <CardTitle className="h5">{t("cohortLearningPreferences.header")}</CardTitle>
        <CardDescription className="body-lg-md">
          {t("cohortLearningPreferences.subHeader")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SettingItem
          id="cohort-learning-enabled"
          label={t("cohortLearningPreferences.settings.cohortLearningEnabled.label")}
          description={t("cohortLearningPreferences.settings.cohortLearningEnabled.description")}
          checked={isEnabled}
          onCheckedChange={() =>
            updateCohortSetting(ALLOWED_COHORT_SETTINGS.COHORT_LEARNING_ENABLED)
          }
        />
      </CardContent>
    </Card>
  );
}
