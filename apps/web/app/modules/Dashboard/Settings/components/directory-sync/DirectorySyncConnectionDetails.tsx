import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useUpsertDirectorySyncConnection } from "~/api/mutations/admin/useUpsertDirectorySyncConnection";
import { useVerifyDirectorySyncConnection } from "~/api/mutations/admin/useVerifyDirectorySyncConnection";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

import { SETTINGS_PAGE_HANDLES } from "../../../../../../e2e/data/settings/handles";

import { DirectorySyncSetupInstructions } from "./DirectorySyncSetupGuide";

import type { DirectorySyncConnection } from "./directorySync.types";
import type { DirectorySyncProvider } from "@repo/shared";
import type { GetDirectorySyncSetupDetailsResponse } from "~/api/generated-api";

type DirectorySyncConnectionDetailsProps = {
  provider: DirectorySyncProvider;
  connection: DirectorySyncConnection;
  setupDetails: GetDirectorySyncSetupDetailsResponse["data"] | undefined;
};

/**
 * Connection details that rarely change: which Google admin the sync acts as and the access to
 * grant in Google. Folded away so day-to-day settings stay short.
 */
export function DirectorySyncConnectionDetails({
  provider,
  connection,
  setupDetails,
}: DirectorySyncConnectionDetailsProps) {
  const { t } = useTranslation();

  return (
    <Accordion type="single" collapsible>
      <AccordionItem
        value="connection-details"
        className="overflow-hidden rounded-lg border border-neutral-200"
      >
        <AccordionTrigger className="gap-3 px-4 py-3 text-left hover:no-underline">
          <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-neutral-900">
            <CheckCircle2 className="size-4 shrink-0 text-success-700" aria-hidden="true" />
            <span className="truncate">
              {t("directorySync.connectionDetails.connectedVia", {
                email: connection.administratorEmail,
              })}
            </span>
          </span>
        </AccordionTrigger>
        <AccordionContent className="space-y-4 border-t border-neutral-200 p-4">
          <AdministratorEmailForm provider={provider} connection={connection} />
          {setupDetails && <DirectorySyncSetupInstructions setupDetails={setupDetails} />}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

/** Changing the administrator needs a new verification, so saving also verifies. */
function AdministratorEmailForm({
  provider,
  connection,
}: {
  provider: DirectorySyncProvider;
  connection: DirectorySyncConnection;
}) {
  const { t } = useTranslation();
  const [administratorEmail, setAdministratorEmail] = useState(connection.administratorEmail);
  const { mutateAsync: upsertConnection, isPending: isSaving } = useUpsertDirectorySyncConnection();
  const { mutateAsync: verifyConnection, isPending: isVerifying } =
    useVerifyDirectorySyncConnection();

  const trimmedEmail = administratorEmail.trim();
  const hasChanged = trimmedEmail.toLowerCase() !== connection.administratorEmail.toLowerCase();

  const changeAdministrator = async () => {
    await upsertConnection({
      provider,
      connectionSettings: {
        administratorEmail: trimmedEmail,
        scopeType: connection.scopeType,
        scopeExternalIds: connection.scopeExternalIds,
        defaultRoleId: connection.defaultRoleId,
        archiveUsersOutsideScope: connection.archiveUsersOutsideScope,
        sendWelcomeEmail: connection.sendWelcomeEmail,
        archiveLimitPercentage: connection.archiveLimitPercentage,
      },
    });
    await verifyConnection(provider);
  };

  return (
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
          data-testid={SETTINGS_PAGE_HANDLES.DIRECTORY_SYNC_ADMINISTRATOR_EMAIL_INPUT}
        />
        <Button
          variant="outline"
          className="shrink-0"
          onClick={changeAdministrator}
          disabled={!trimmedEmail || !hasChanged || isSaving || isVerifying}
        >
          {t("directorySync.connectionDetails.saveAndVerify")}
        </Button>
      </div>
      <p className="body-sm text-neutral-600">{t("directorySync.form.administratorEmailHelp")}</p>
    </div>
  );
}
