import { DISCUSSION_NOTIFICATION_PREFERENCES } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { useUpdateNotificationPreferences } from "~/api/mutations/useUpdateNotificationPreferences";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

import { SETTINGS_PAGE_HANDLES } from "../../../../../e2e/data/settings/handles";

import { SettingItem } from "./SettingItem";

import type { UserSettings } from "../types";
import type { DiscussionNotificationPreference } from "@repo/shared";

const PREFERENCES: { preference: DiscussionNotificationPreference; translationKey: string }[] = [
  { preference: DISCUSSION_NOTIFICATION_PREFERENCES.REPLY_IN_APP, translationKey: "replyInApp" },
  { preference: DISCUSSION_NOTIFICATION_PREFERENCES.REPLY_EMAILS, translationKey: "replyEmails" },
  {
    preference: DISCUSSION_NOTIFICATION_PREFERENCES.MENTION_EMAILS,
    translationKey: "mentionEmails",
  },
];

type DiscussionNotificationPreferencesProps = {
  settings: UserSettings;
};

export function DiscussionNotificationPreferences({
  settings,
}: DiscussionNotificationPreferencesProps) {
  const { t } = useTranslation();
  const { mutate: updatePreferences, isPending } = useUpdateNotificationPreferences();

  return (
    <Card data-testid={SETTINGS_PAGE_HANDLES.DISCUSSION_NOTIFICATIONS_CARD}>
      <CardHeader>
        <CardTitle className="h5">{t("discussionNotifications.preferences.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {PREFERENCES.map(({ preference, translationKey }) => {
          const isEnabled = settings[preference] !== false;

          return (
            <SettingItem
              key={preference}
              id={preference}
              label={t(`discussionNotifications.preferences.${translationKey}.label`)}
              description={t(`discussionNotifications.preferences.${translationKey}.description`)}
              checked={isEnabled}
              disabled={isPending}
              tooltipTranslationKey="discussionNotifications.preferences.saving"
              testId={SETTINGS_PAGE_HANDLES.discussionNotificationSwitch(preference)}
              onCheckedChange={() => updatePreferences({ [preference]: !isEnabled })}
            />
          );
        })}
      </CardContent>
    </Card>
  );
}
