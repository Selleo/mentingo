import { ALLOWED_NEWS_SETTINGS } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { useChangeNewsSetting } from "~/api/mutations/admin/useChangeNewsSetting";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { SettingItem } from "~/modules/Dashboard/Settings/components/SettingItem";

import type { GlobalSettings } from "../../types";

interface NewsPreferencesProps {
  globalSettings: GlobalSettings;
}

export default function NewsPreferences({ globalSettings }: NewsPreferencesProps) {
  const { t } = useTranslation();
  const { mutate: updateNewsPreference } = useChangeNewsSetting();

  return (
    <Card id="news-preferences">
      <CardHeader>
        <CardTitle className="h5">{t("newsPreferences.header")}</CardTitle>
        <CardDescription className="body-lg-md">{t("newsPreferences.subHeader")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SettingItem
          id="news-enabled"
          label={t("newsPreferences.settings.newsEnabled.label")}
          description={t("newsPreferences.settings.newsEnabled.description")}
          checked={globalSettings.newsEnabled}
          onCheckedChange={() => updateNewsPreference(ALLOWED_NEWS_SETTINGS.NEWS_ENABLED)}
        />
        <SettingItem
          id="news-public"
          label={t("newsPreferences.settings.newsPublic.label")}
          description={t("newsPreferences.settings.newsPublic.description")}
          checked={globalSettings.unregisteredUserNewsAccessibility}
          onCheckedChange={() =>
            updateNewsPreference(ALLOWED_NEWS_SETTINGS.UNREGISTERED_USER_NEWS_ACCESSIBILITY)
          }
          disabled={!globalSettings.newsEnabled}
          tooltipTranslationKey="newsPreferences.tooltip.disabled"
        />
      </CardContent>
    </Card>
  );
}
