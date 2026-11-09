import { useTranslation } from "react-i18next";

import { useToggleGamificationEnabled } from "~/api/mutations/admin/useToggleGamificationEnabled";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { SettingItem } from "~/modules/Dashboard/Settings/components/SettingItem";

import type { GlobalSettings } from "../../types";

interface GamificationPreferencesProps {
  globalSettings: GlobalSettings;
}

export default function GamificationPreferences({ globalSettings }: GamificationPreferencesProps) {
  const { t } = useTranslation();
  // The endpoint flips the stored value, so a second click mid-request would undo the first.
  const { mutate: toggleGamification, isPending: isTogglingGamification } =
    useToggleGamificationEnabled();

  return (
    <Card id="gamification-preferences">
      <CardHeader>
        <CardTitle className="h5">{t("gamification.admin.title")}</CardTitle>
        <CardDescription className="body-lg-md">
          {t("gamification.admin.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SettingItem
          id="gamification-enabled"
          label={t("gamification.admin.enabled.label")}
          description={t("gamification.admin.enabled.description")}
          checked={Boolean(globalSettings.gamificationEnabled)}
          onCheckedChange={() => toggleGamification()}
          disabled={isTogglingGamification}
        />
      </CardContent>
    </Card>
  );
}
