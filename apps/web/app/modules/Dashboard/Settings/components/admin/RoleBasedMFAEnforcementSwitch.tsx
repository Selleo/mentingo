import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useUpdateMFAEnforcedRoles } from "~/api/mutations/admin/useUpdateMFAEnforcedRoles";
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
import { USER_ROLE, type UserRole } from "~/config/userRoles";

import { SETTINGS_PAGE_HANDLES } from "../../../../../../e2e/data/settings/handles";

import type { GetPublicGlobalSettingsResponse } from "~/api/generated-api";

interface MFAEnforcementSwitchProps {
  MFAEnforcedRoles: GetPublicGlobalSettingsResponse["data"]["MFAEnforcedRoles"];
}
const USER_ROLE_VALUES = [USER_ROLE.admin, USER_ROLE.student, USER_ROLE.contentCreator] as const;

export default function RoleBasedMFAEnforcementSwitch({
  MFAEnforcedRoles,
}: MFAEnforcementSwitchProps) {
  const { t } = useTranslation();

  const [roleStates, setRoleStates] = useState<Record<UserRole, boolean>>(() => {
    const initialState: Record<UserRole, boolean> = {} as Record<UserRole, boolean>;
    USER_ROLE_VALUES.forEach((role) => {
      initialState[role] = MFAEnforcedRoles.includes(role);
    });
    return initialState;
  });

  const { mutate: updateMFAEnforcedRoles, isPending } = useUpdateMFAEnforcedRoles();

  const toggleRoleSwitch = (role: UserRole) => {
    setRoleStates((prev) => ({
      ...prev,
      [role]: !prev[role],
    }));
  };

  const hasChanges = () => {
    return USER_ROLE_VALUES.some((role) => {
      const wasEnforced = MFAEnforcedRoles.includes(role);
      const isEnforced = roleStates[role];
      return wasEnforced !== isEnforced;
    });
  };

  const saveMFAEnforcement = () => {
    if (hasChanges()) {
      const updateData = {
        admin: roleStates[USER_ROLE.admin],
        student: roleStates[USER_ROLE.student],
        content_creator: roleStates[USER_ROLE.contentCreator],
      };
      updateMFAEnforcedRoles(updateData);
    }
  };

  return (
    <Card id="mfa-enforcement" data-testid={SETTINGS_PAGE_HANDLES.MFA_ENFORCEMENT_CARD}>
      <CardHeader>
        <CardTitle className="h5">{t("MFAEnforcementView.header")}</CardTitle>
        <CardDescription className="body-lg-md">
          {t("MFAEnforcementView.subHeader")}
        </CardDescription>
      </CardHeader>
      <CardContent className="body-sm-md">
        <div className="mb-4">{t("MFAEnforcementView.description")}</div>
        <div className="space-y-2">
          {USER_ROLE_VALUES.map((role) => (
            <div key={role} className="flex items-center justify-between">
              <p>{t(`MFAEnforcementView.roles.${role}`)}</p>
              <div className="group inline-flex items-center gap-2">
                <span className="flex-1 text-right details">
                  {t("MFAEnforcementView.switch.disabled")}
                </span>
                <Switch
                  checked={roleStates[role]}
                  onCheckedChange={() => toggleRoleSwitch(role)}
                  data-testid={SETTINGS_PAGE_HANDLES.mfaRoleSwitch(role)}
                />
                <span className="flex-1 text-left details">
                  {t("MFAEnforcementView.switch.enabled")}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="border-t px-6 py-4">
        <Button
          disabled={isPending || !hasChanges()}
          type="submit"
          onClick={saveMFAEnforcement}
          data-testid={SETTINGS_PAGE_HANDLES.MFA_ENFORCEMENT_SAVE}
        >
          {t("common.button.save")}
        </Button>
      </CardFooter>
    </Card>
  );
}
