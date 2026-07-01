import { SYSTEM_ROLE_SLUGS } from "@repo/shared";
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

import { SETTINGS_PAGE_HANDLES } from "../../../../../../e2e/data/settings/handles";

import type { GetPublicGlobalSettingsResponse } from "~/api/generated-api";

interface MFAEnforcementSwitchProps {
  MFAEnforcedRoles: GetPublicGlobalSettingsResponse["data"]["MFAEnforcedRoles"];
}

const MFA_ENFORCEMENT_ROLE_VALUES = [
  SYSTEM_ROLE_SLUGS.ADMIN,
  SYSTEM_ROLE_SLUGS.STUDENT,
  SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
  SYSTEM_ROLE_SLUGS.TRAINER,
] as const;

type MFAEnforcementRole = (typeof MFA_ENFORCEMENT_ROLE_VALUES)[number];

export default function RoleBasedMFAEnforcementSwitch({
  MFAEnforcedRoles,
}: MFAEnforcementSwitchProps) {
  const { t } = useTranslation();

  const [roleStates, setRoleStates] = useState<Record<MFAEnforcementRole, boolean>>(() => {
    const initialState: Record<MFAEnforcementRole, boolean> = {} as Record<
      MFAEnforcementRole,
      boolean
    >;
    MFA_ENFORCEMENT_ROLE_VALUES.forEach((role) => {
      initialState[role] = MFAEnforcedRoles.includes(role);
    });
    return initialState;
  });

  const { mutate: updateMFAEnforcedRoles, isPending } = useUpdateMFAEnforcedRoles();

  const toggleRoleSwitch = (role: MFAEnforcementRole) => {
    setRoleStates((prev) => ({
      ...prev,
      [role]: !prev[role],
    }));
  };

  const hasChanges = () => {
    return MFA_ENFORCEMENT_ROLE_VALUES.some((role) => {
      const wasEnforced = MFAEnforcedRoles.includes(role);
      const isEnforced = roleStates[role];
      return wasEnforced !== isEnforced;
    });
  };

  const saveMFAEnforcement = () => {
    if (hasChanges()) {
      const updateData = MFA_ENFORCEMENT_ROLE_VALUES.reduce<Record<string, boolean>>(
        (roles, role) => {
          roles[role] = roleStates[role];
          return roles;
        },
        {},
      );

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
          {MFA_ENFORCEMENT_ROLE_VALUES.map((role) => (
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
