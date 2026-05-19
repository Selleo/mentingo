import { useTranslation } from "react-i18next";

import { useToggleLearningPathsEnabled } from "~/api/mutations/admin/useToggleLearningPathsEnabled";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { SettingItem } from "~/modules/Dashboard/Settings/components/SettingItem";

import type { GlobalSettings } from "../../types";

interface LearningPathsPreferencesProps {
  globalSettings: GlobalSettings;
}

export default function LearningPathsPreferences({
  globalSettings,
}: LearningPathsPreferencesProps) {
  const { t } = useTranslation();
  const { mutate: toggleLearningPathsEnabled } = useToggleLearningPathsEnabled();

  return (
    <Card id="learning-paths-preferences">
      <CardHeader>
        <CardTitle className="h5">{t("learningPathsPreferences.header")}</CardTitle>
        <CardDescription className="body-lg-md">
          {t("learningPathsPreferences.subHeader")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SettingItem
          id="learning-paths-enabled"
          label={t("learningPathsPreferences.settings.learningPathsEnabled.label")}
          description={t("learningPathsPreferences.settings.learningPathsEnabled.description")}
          checked={globalSettings.learningPathsEnabled}
          onCheckedChange={() => toggleLearningPathsEnabled()}
        />
      </CardContent>
    </Card>
  );
}
