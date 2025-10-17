import { useTranslation } from "react-i18next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

import { GlobalPreferences } from "./GlobalPreferences";

import type { GlobalSettings } from "../../types";

interface AdminPreferencesProps {
  globalSettings: GlobalSettings;
}

export default function AdminPreferences({ globalSettings }: AdminPreferencesProps) {
  const { t } = useTranslation();

  return (
    <Card id="admin-preferences">
      <CardHeader>
        <CardTitle className="h5">{t("adminPreferences.courseSettings")}</CardTitle>
        <CardDescription className="body-lg-md">{t("adminPreferences.subHeader")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <GlobalPreferences globalSettings={globalSettings} />
      </CardContent>
    </Card>
  );
}
