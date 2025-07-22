import { useTranslation } from "react-i18next";

import { useChangeNewUserEmailNotification } from "~/api/mutations/admin/useChangeNewUserEmailNotification";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";

import { SettingItem } from "./SettingItem";

import type { UserSettings } from "~/api/generated-api";

interface NotificationPreferencesProps {
  userSettings: UserSettings;
}

export default function NotificationPreferences({ userSettings }: NotificationPreferencesProps) {
  const { t } = useTranslation();
  const { mutate: changeNewUserEmailNotification } = useChangeNewUserEmailNotification();

  const handleNotificationChange = () => {
    changeNewUserEmailNotification();
  };

  return (
    <Card id="admin-notifications-preferences">
      <CardHeader>
        <CardTitle>{t("adminPreferences.notificationSettings")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="space-y-4">
            <SettingItem
              id="newUserNotifications"
              label={t("adminPreferences.field.newUserNotifications")}
              description={t("adminPreferences.field.newUserNotificationsDescription")}
              checked={userSettings.adminNewUserNotification}
              onCheckedChange={handleNotificationChange}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
