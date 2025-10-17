import { useTranslation } from "react-i18next";

import { useChangeFinishedCourseNotification } from "~/api/mutations/admin/useChangeFinishedCourseNotification";
import { useChangeNewUserEmailNotification } from "~/api/mutations/admin/useChangeNewUserEmailNotification";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";

import { SettingItem } from "./SettingItem";

import type { AdminSettings } from "../types";

interface NotificationPreferencesProps {
  adminSettings: AdminSettings;
}

export default function NotificationPreferences({ adminSettings }: NotificationPreferencesProps) {
  const { t } = useTranslation();
  const { mutate: changeNewUserEmailNotification } = useChangeNewUserEmailNotification();
  const { mutate: changeFinishedCourseNotification } = useChangeFinishedCourseNotification();

  const handleNotificationChange = () => {
    changeNewUserEmailNotification();
  };

  return (
    <Card id="admin-notifications-preferences">
      <CardHeader>
        <CardTitle className="h5">{t("adminPreferences.notificationSettings")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="space-y-4">
          <SettingItem
            id="newUserNotifications"
            label={t("adminPreferences.field.newUserNotifications")}
            description={t("adminPreferences.field.newUserNotificationsDescription")}
            checked={adminSettings.adminNewUserNotification}
            onCheckedChange={handleNotificationChange}
          />
        </div>
        <div className="space-y-4">
          <SettingItem
            id="finishedCourseNotification"
            label={t("adminPreferences.field.finishedCourseNotification")}
            description={t("adminPreferences.field.finishedCourseNotificationDescription")}
            checked={adminSettings.adminFinishedCourseNotification}
            onCheckedChange={changeFinishedCourseNotification}
          />
        </div>
      </CardContent>
    </Card>
  );
}
