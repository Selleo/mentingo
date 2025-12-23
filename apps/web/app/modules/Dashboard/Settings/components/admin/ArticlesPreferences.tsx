import { ALLOWED_ARTICLES_SETTINGS } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { useChangeArticlesSetting } from "~/api/mutations/admin/useChangeArticlesSetting";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { SettingItem } from "~/modules/Dashboard/Settings/components/SettingItem";

import type { GlobalSettings } from "../../types";

interface ArticlesPreferencesProps {
  globalSettings: GlobalSettings;
}

export default function ArticlesPreferences({ globalSettings }: ArticlesPreferencesProps) {
  const { t } = useTranslation();
  const { mutate: updateArticlesPreference } = useChangeArticlesSetting();

  return (
    <Card id="articles-preferences">
      <CardHeader>
        <CardTitle className="h5">{t("articlesPreferences.header")}</CardTitle>
        <CardDescription className="body-lg-md">
          {t("articlesPreferences.subHeader")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SettingItem
          id="articles-enabled"
          label={t("articlesPreferences.settings.articlesEnabled.label")}
          description={t("articlesPreferences.settings.articlesEnabled.description")}
          checked={globalSettings.articlesEnabled}
          onCheckedChange={() =>
            updateArticlesPreference(ALLOWED_ARTICLES_SETTINGS.ARTICLES_ENABLED)
          }
        />
        <SettingItem
          id="articles-public"
          label={t("articlesPreferences.settings.articlesPublic.label")}
          description={t("articlesPreferences.settings.articlesPublic.description")}
          checked={globalSettings.unregisteredUserArticlesAccessibility}
          onCheckedChange={() =>
            updateArticlesPreference(
              ALLOWED_ARTICLES_SETTINGS.UNREGISTERED_USER_ARTICLES_ACCESSIBILITY,
            )
          }
          disabled={!globalSettings.articlesEnabled}
          tooltipTranslationKey="articlesPreferences.tooltip.disabled"
        />
      </CardContent>
    </Card>
  );
}
