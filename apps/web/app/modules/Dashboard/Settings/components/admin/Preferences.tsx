import { useTranslation } from "react-i18next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

import { GlobalPreferences } from "./GlobalPreferences";

import type { GlobalSettings } from "~/api/generated-api";

interface AdminPreferencesProps {
  globalSettings: GlobalSettings;
}

export default function AdminPreferences({ globalSettings }: AdminPreferencesProps) {
  const { t } = useTranslation();

  return (
    <Card id="admin-preferences">
      <CardHeader>
        <CardTitle>{t("adminPreferences.header")}</CardTitle>
        <CardDescription>{t("adminPreferences.subHeader")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <GlobalPreferences globalSettings={globalSettings} />
      </CardContent>
    </Card>
  );
}
