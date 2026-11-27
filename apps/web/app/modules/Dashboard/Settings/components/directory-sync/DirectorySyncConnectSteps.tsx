import {
  DIRECTORY_SYNC_SCOPE_TYPES,
  SYSTEM_ROLE_SLUGS,
  type DirectorySyncProvider,
} from "@repo/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useUpsertDirectorySyncConnection } from "~/api/mutations/admin/useUpsertDirectorySyncConnection";
import { useVerifyDirectorySyncConnection } from "~/api/mutations/admin/useVerifyDirectorySyncConnection";
import { useRoles } from "~/api/queries/admin/useRoles";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

import { SETTINGS_PAGE_HANDLES } from "../../../../../../e2e/data/settings/handles";

import { DirectorySyncSetupGuide } from "./DirectorySyncSetupGuide";

import type { DirectorySyncConnection } from "./directorySync.types";
import type { ReactNode } from "react";
import type { GetDirectorySyncSetupDetailsResponse } from "~/api/generated-api";

type DirectorySyncConnectStepsProps = {
  provider: DirectorySyncProvider;
  connection: DirectorySyncConnection | null;
  setupDetails: GetDirectorySyncSetupDetailsResponse["data"] | undefined;
  isServiceAccountKeyMissing: boolean;
};

/**
 * First-time setup: grant access in Google, then connect with one admin email. Everything else
 * starts from safe defaults and is configured after the connection is verified.
 */
export function DirectorySyncConnectSteps({
  provider,
  connection,
  setupDetails,
  isServiceAccountKeyMissing,
}: DirectorySyncConnectStepsProps) {
  const { t } = useTranslation();
  const { data: roles = [] } = useRoles();
  const { mutateAsync: upsertConnection, isPending: isSaving } = useUpsertDirectorySyncConnection();
  const { mutateAsync: verifyConnection, isPending: isVerifying } =
    useVerifyDirectorySyncConnection();

  const [administratorEmail, setAdministratorEmail] = useState(
    connection?.administratorEmail ?? "",
  );

  const defaultRoleId =
    connection?.defaultRoleId ??
    roles.find((role) => role.slug === SYSTEM_ROLE_SLUGS.STUDENT)?.id ??
    roles[0]?.id;

  const canConnect = Boolean(
    administratorEmail.trim() && defaultRoleId && !isServiceAccountKeyMissing,
  );

  const connectDirectory = async () => {
    if (!defaultRoleId) return;

    await upsertConnection({
      provider,
      connectionSettings: {
        administratorEmail: administratorEmail.trim(),
        scopeType: connection?.scopeType ?? DIRECTORY_SYNC_SCOPE_TYPES.ALL_USERS,
        scopeExternalIds: connection?.scopeExternalIds ?? [],
        defaultRoleId,
        archiveUsersOutsideScope: connection?.archiveUsersOutsideScope ?? true,
        sendWelcomeEmail: connection?.sendWelcomeEmail ?? false,
        archiveLimitPercentage: connection?.archiveLimitPercentage ?? null,
      },
    });
    await verifyConnection(provider);
  };

  return (
    <ol className="space-y-6">
      <ConnectStep number={1} title={t("directorySync.connect.grantAccessTitle")}>
        <DirectorySyncSetupGuide
          setupDetails={setupDetails}
          isServiceAccountKeyMissing={isServiceAccountKeyMissing}
        />
      </ConnectStep>

      <ConnectStep number={2} title={t("directorySync.connect.connectTitle")}>
        <div className="max-w-xl space-y-2">
          <Label htmlFor="directory-sync-administrator-email">
            {t("directorySync.form.administratorEmail")}
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="directory-sync-administrator-email"
              type="email"
              value={administratorEmail}
              onChange={(event) => setAdministratorEmail(event.target.value)}
              placeholder="admin@company.com"
              data-testid={SETTINGS_PAGE_HANDLES.DIRECTORY_SYNC_ADMINISTRATOR_EMAIL_INPUT}
            />
            <Button
              onClick={connectDirectory}
              disabled={!canConnect || isSaving || isVerifying}
              className="shrink-0"
              data-testid={SETTINGS_PAGE_HANDLES.DIRECTORY_SYNC_VERIFY_BUTTON}
            >
              {t("directorySync.connect.connectButton")}
            </Button>
          </div>
          <p className="body-sm text-neutral-600">
            {t("directorySync.form.administratorEmailHelp")}
          </p>
        </div>
      </ConnectStep>
    </ol>
  );
}

function ConnectStep({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-semibold text-primary-700">
        {number}
      </span>
      <div className="min-w-0 flex-1 space-y-3 pt-0.5">
        <p className="body-base-md text-neutral-950">{title}</p>
        {children}
      </div>
    </li>
  );
}
