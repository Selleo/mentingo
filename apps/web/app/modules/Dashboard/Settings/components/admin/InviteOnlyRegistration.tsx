import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useUpdateInviteOnlyRegistration } from "~/api/mutations/admin/useUpdateInviteOnlyRegistration";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Switch } from "~/components/ui/switch";

interface InviteOnlyRegistrationSwitchProps {
  inviteOnlyRegistration: boolean;
}
export const InviteOnlyRegistration = ({
  inviteOnlyRegistration,
}: InviteOnlyRegistrationSwitchProps) => {
  const { t } = useTranslation();
  const [isChecked, setIsChecked] = useState(inviteOnlyRegistration || false);

  const { mutate: updateInviteOnlyRegistration, isPending } = useUpdateInviteOnlyRegistration();

  const toggleSwitch = () => setIsChecked((prev) => !prev);

  const saveInviteOnlyRegistration = () => {
    if (isChecked !== inviteOnlyRegistration) {
      updateInviteOnlyRegistration();
    }
  };

  return (
    <Card id="invite-only-registration">
      <CardHeader>
        <CardTitle>{t("inviteOnlyRegistrationView.header")}</CardTitle>
        <CardDescription>{t("inviteOnlyRegistrationView.subHeader")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
        <p className="md:w-3/4">{t("inviteOnlyRegistrationView.description")}</p>
        <div className="group inline-flex items-center gap-2">
          <span className="flex-1 text-right text-sm font-medium">
            {t("inviteOnlyRegistrationView.switch.disabled")}
          </span>
          <Switch checked={isChecked} onCheckedChange={toggleSwitch} />
          <span className="flex-1 text-left text-sm font-medium">
            {t("inviteOnlyRegistrationView.switch.enabled")}
          </span>
        </div>
      </CardContent>
      <CardFooter className="border-t px-6 py-4">
        <Button disabled={isPending} type="submit" onClick={saveInviteOnlyRegistration}>
          {t("common.button.save")}
        </Button>
      </CardFooter>
    </Card>
  );
};
