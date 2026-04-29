import { ALLOWED_DISCUSSIONS_SETTINGS } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { useChangeDiscussionsSetting } from "~/api/mutations/admin/useChangeDiscussionsSetting";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { SettingItem } from "~/modules/Dashboard/Settings/components/SettingItem";

import type { GlobalSettings } from "../../types";

interface DiscussionsPreferencesProps {
  globalSettings: GlobalSettings;
}

export default function DiscussionsPreferences({ globalSettings }: DiscussionsPreferencesProps) {
  const { t } = useTranslation();
  const { mutate: updateDiscussionsPreference } = useChangeDiscussionsSetting();

  return (
    <Card id="discussions-preferences">
      <CardHeader>
        <CardTitle className="h5">{t("discussionsPreferences.header")}</CardTitle>
        <CardDescription className="body-lg-md">
          {t("discussionsPreferences.subHeader")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SettingItem
          id="discussions-enabled"
          label={t("discussionsPreferences.settings.discussionsEnabled.label")}
          description={t("discussionsPreferences.settings.discussionsEnabled.description")}
          checked={globalSettings.discussionsEnabled}
          onCheckedChange={() =>
            updateDiscussionsPreference(ALLOWED_DISCUSSIONS_SETTINGS.DISCUSSIONS_ENABLED)
          }
        />
      </CardContent>
    </Card>
  );
}
