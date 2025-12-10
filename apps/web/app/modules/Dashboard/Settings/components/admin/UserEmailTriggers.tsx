import { useTranslation } from "react-i18next";

import useChangeUserEmailTrigger from "~/api/mutations/admin/useChangeUserEmailTrigger";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { SettingItem } from "~/modules/Dashboard/Settings/components/SettingItem";

import type { GetPublicGlobalSettingsResponse } from "~/api/generated-api";

interface UserEmailTriggersProps {
  userEmailTriggers: GetPublicGlobalSettingsResponse["data"]["userEmailTriggers"];
}

export default function UserEmailTriggers({ userEmailTriggers }: UserEmailTriggersProps) {
  const { t } = useTranslation();
  const { mutate: changeUserEmailTrigger } = useChangeUserEmailTrigger();

  return (
    <Card id="user-email-triggers">
      <CardHeader>
        <CardTitle className="h5">{t("userEmailTriggers.header")}</CardTitle>
        <CardDescription>{t("userEmailTriggers.subHeader")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.keys(userEmailTriggers).map((emailTrigger, idx) => (
          <SettingItem
            key={idx}
            id={emailTrigger}
            label={t(`userEmailTriggers.settings.${emailTrigger}`)}
            description={t(`userEmailTriggers.settings.${emailTrigger}Description`)}
            checked={userEmailTriggers[emailTrigger as keyof typeof userEmailTriggers]}
            onCheckedChange={() => changeUserEmailTrigger({ triggerKey: emailTrigger })}
          />
        ))}
      </CardContent>
    </Card>
  );
}
