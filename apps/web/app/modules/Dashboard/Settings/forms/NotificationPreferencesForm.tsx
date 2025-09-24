import { useTranslation } from "react-i18next";

import { useChangeNewUserEmailNotification } from "~/api/mutations/admin/useChangeNewUserEmailNotification";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";

import type { AdminSettings } from "../types";

interface NotificationPreferencesFormProps {
  adminSettings: AdminSettings;
}

export default function NotificationPreferencesForm({
  adminSettings,
}: NotificationPreferencesFormProps) {
  const { t } = useTranslation();
  const { mutate: changeNewUserEmailNotification } = useChangeNewUserEmailNotification();

  const handleNotificationChange = () => {
    changeNewUserEmailNotification();
  };

  return (
    <Card id="admin-preferences">
      <CardHeader>
        <CardTitle>{t("adminPreferences.header")}</CardTitle>
        <CardDescription>{t("adminPreferences.subHeader")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="mb-4 text-lg font-medium">{t("adminPreferences.notificationSettings")}</h3>
          <div className="space-y-4">
            <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <Label htmlFor="newUserNotifications">
                  {t("adminPreferences.field.newUserNotifications")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("adminPreferences.field.newUserNotificationsDescription")}
                </p>
              </div>
              <Switch
                id="newUserNotifications"
                checked={adminSettings.adminNewUserNotification}
                onCheckedChange={handleNotificationChange}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
