import { useTranslation } from "react-i18next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

import CoursesAccessibilityPreferences from "./CoursesAccessibilityPreferences";
import NotificationPreferences from "./NotificationPreferences";

import type { GlobalSettings, UserSettings } from "~/api/generated-api";

interface AdminPreferencesProps {
  userSettings: UserSettings;
  globalSettings: GlobalSettings;
}

export default function AdminPreferences({ userSettings, globalSettings }: AdminPreferencesProps) {
  const { t } = useTranslation();

  return (
    <Card id="admin-preferences">
      <CardHeader>
        <CardTitle>{t("adminPreferences.header")}</CardTitle>
        <CardDescription>{t("adminPreferences.subHeader")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <NotificationPreferences userSettings={userSettings} />
        <CoursesAccessibilityPreferences globalSettings={globalSettings} />
      </CardContent>
    </Card>
  );
}
