import { MoreHorizontal, RefreshCw, ShieldCheck, Unlink } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useDeleteDirectorySyncConnection } from "~/api/mutations/admin/useDeleteDirectorySyncConnection";
import { useRequestDirectorySync } from "~/api/mutations/admin/useRequestDirectorySync";
import { useVerifyDirectorySyncConnection } from "~/api/mutations/admin/useVerifyDirectorySyncConnection";
import { useDirectorySyncConnection } from "~/api/queries/admin/useDirectorySyncConnection";
import { useDirectorySyncSetupDetails } from "~/api/queries/admin/useDirectorySyncSetupDetails";
import GoogleLogo from "~/assets/svgs/google.svg?react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { cn } from "~/lib/utils";
import Loader from "~/modules/common/Loader/Loader";
import { formatLocalizedDate } from "~/utils/formatLocalizedDate";

import { SETTINGS_PAGE_HANDLES } from "../../../../../../e2e/data/settings/handles";

import { DIRECTORY_SYNC_SETTINGS_PROVIDER } from "./directorySync.constants";
import {
  getConnectionStatusBadgeVariant,
  getRunChangeCounts,
  getRunStatusBadgeVariant,
} from "./directorySync.utils";
import { DirectorySyncConnectionDetails } from "./DirectorySyncConnectionDetails";
import { DirectorySyncConnectionForm } from "./DirectorySyncConnectionForm";
import { DirectorySyncConnectSteps } from "./DirectorySyncConnectSteps";
import { DirectorySyncGroupsEditor } from "./DirectorySyncGroupsEditor";
import { DIRECTORY_SYNC_NOTICE_TONES, DirectorySyncNotice } from "./DirectorySyncNotice";
import { DirectorySyncRunHistory } from "./DirectorySyncRunHistory";
import { useRefreshDirectoryDataAfterSync } from "./useRefreshDirectoryDataAfterSync";

import type { DirectorySyncConnection } from "./directorySync.types";

const DIRECTORY_SYNC_TABS = {
  SETTINGS: "settings",
  GROUPS: "groups",
  HISTORY: "history",
} as const;

export function DirectorySyncCard() {
  const { t } = useTranslation();
  const provider = DIRECTORY_SYNC_SETTINGS_PROVIDER;

  const { data: connection = null, isLoading } = useDirectorySyncConnection(provider);
  const { data: setupDetails, isError: isServiceAccountKeyMissing } =
    useDirectorySyncSetupDetails(provider);

  const verifiedConnection = connection?.isVerified ? connection : null;

  useRefreshDirectoryDataAfterSync(connection?.latestRun ?? null);

  return (
    <Card
      id="directory-sync"
      className="border-[#1a73e8]/25"
      data-testid={SETTINGS_PAGE_HANDLES.DIRECTORY_SYNC_CARD}
    >
      <div className="h-1 rounded-t-[inherit] bg-[#1a73e8]" />
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#e8f0fe]">
              <GoogleLogo className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="h5">{t("directorySync.title")}</CardTitle>
                {connection && (
                  <Badge
                    variant={getConnectionStatusBadgeVariant(connection.status)}
                    data-testid={SETTINGS_PAGE_HANDLES.DIRECTORY_SYNC_STATUS}
                  >
                    {t(`directorySync.statuses.${connection.status}`)}
                  </Badge>
                )}
              </div>
              <CardDescription className="body-lg-md mt-1">
                {t("directorySync.description")}
              </CardDescription>
            </div>
          </div>
          {connection && (
            <DirectorySyncHeaderActions
              connection={connection}
              isVerified={Boolean(verifiedConnection)}
            />
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {isLoading && (
          <div className="flex justify-center py-6">
            <Loader />
          </div>
        )}

        {!isLoading && !verifiedConnection && (
          <DirectorySyncConnectSteps
            key={connection?.id ?? "new"}
            provider={provider}
            connection={connection}
            setupDetails={setupDetails}
            isServiceAccountKeyMissing={isServiceAccountKeyMissing}
          />
        )}

        {!isLoading && verifiedConnection && (
          <>
            <DirectorySyncStatus connection={verifiedConnection} />

            <Tabs defaultValue={DIRECTORY_SYNC_TABS.SETTINGS}>
              <TabsList>
                <TabsTrigger value={DIRECTORY_SYNC_TABS.SETTINGS}>
                  {t("directorySync.tabs.settings")}
                </TabsTrigger>
                <TabsTrigger value={DIRECTORY_SYNC_TABS.GROUPS}>
                  {t("directorySync.tabs.groups")}
                </TabsTrigger>
                <TabsTrigger value={DIRECTORY_SYNC_TABS.HISTORY}>
                  {t("directorySync.tabs.history")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value={DIRECTORY_SYNC_TABS.SETTINGS} className="space-y-6 pt-4">
                <DirectorySyncConnectionForm
                  key={verifiedConnection.id}
                  provider={provider}
                  connection={verifiedConnection}
                />
                <DirectorySyncConnectionDetails
                  key={verifiedConnection.administratorEmail}
                  provider={provider}
                  connection={verifiedConnection}
                  setupDetails={setupDetails}
                />
              </TabsContent>

              <TabsContent value={DIRECTORY_SYNC_TABS.GROUPS} className="pt-4">
                <DirectorySyncGroupsEditor
                  key={getGroupsEditorKey(verifiedConnection)}
                  provider={provider}
                  connection={verifiedConnection}
                />
              </TabsContent>

              <TabsContent value={DIRECTORY_SYNC_TABS.HISTORY} className="pt-4">
                <DirectorySyncRunHistory provider={provider} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Resets the groups editor when saved mappings change, including a mapped Mentingo group being
 * renamed elsewhere, so the editor never shows stale names.
 */
function getGroupsEditorKey(connection: DirectorySyncConnection) {
  const roleMappingKeys = connection.roleMappings.map(
    (roleMapping) => `${roleMapping.externalGroupId}:${roleMapping.roleId}:${roleMapping.priority}`,
  );
  const groupMappingKeys = connection.groupMappings.map(
    (groupMapping) =>
      `${groupMapping.externalGroupId}:${groupMapping.groupId}:${groupMapping.groupName}`,
  );

  return [connection.id, ...roleMappingKeys, ...groupMappingKeys].join("|");
}

/** One line with the latest result, plus a notice only when something needs attention. */
function DirectorySyncStatus({ connection }: { connection: DirectorySyncConnection }) {
  const { t, i18n } = useTranslation();
  const latestRun = connection.latestRun;

  const latestRunChanges = latestRun
    ? getRunChangeCounts(latestRun)
        .filter(({ count }) => count > 0)
        .map(({ key, count }) => t(`directorySync.runs.counts.${key}`, { count }))
        .join(", ")
    : "";

  return (
    <div className="space-y-3">
      {connection.missingExternalIds.length > 0 && (
        <DirectorySyncNotice
          tone={DIRECTORY_SYNC_NOTICE_TONES.ERROR}
          title={t("directorySync.missingObjects.title")}
          testId={SETTINGS_PAGE_HANDLES.DIRECTORY_SYNC_MISSING_OBJECTS}
        >
          <p>{t("directorySync.missingObjects.description")}</p>
          <p className="break-all font-mono text-xs">{connection.missingExternalIds.join(", ")}</p>
        </DirectorySyncNotice>
      )}

      {connection.lastSuccessfulSyncAt ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-neutral-50 px-4 py-3 text-sm">
          <span className="text-neutral-600">
            {t("directorySync.status.lastSync", {
              date: formatLocalizedDate(i18n.language, connection.lastSuccessfulSyncAt),
            })}
          </span>
          {latestRun && (
            <Badge variant={getRunStatusBadgeVariant(latestRun.status)}>
              {t(`directorySync.runs.statuses.${latestRun.status}`)}
            </Badge>
          )}
          {latestRunChanges && <span className="text-neutral-600">{latestRunChanges}</span>}
        </div>
      ) : (
        <DirectorySyncNotice
          tone={DIRECTORY_SYNC_NOTICE_TONES.INFO}
          title={t("directorySync.firstSyncTitle")}
          testId={SETTINGS_PAGE_HANDLES.DIRECTORY_SYNC_FIRST_SYNC_HINT}
        >
          <p className="text-neutral-700">{t("directorySync.firstSyncHint")}</p>
        </DirectorySyncNotice>
      )}
    </div>
  );
}

type DirectorySyncHeaderActionsProps = {
  connection: DirectorySyncConnection;
  isVerified: boolean;
};

function DirectorySyncHeaderActions({ connection, isVerified }: DirectorySyncHeaderActionsProps) {
  const { t } = useTranslation();
  const provider = connection.provider;
  const [isDisconnectDialogOpen, setIsDisconnectDialogOpen] = useState(false);

  const { mutateAsync: verifyConnection, isPending: isVerifying } =
    useVerifyDirectorySyncConnection();
  const { mutateAsync: requestSync, isPending: isRequestingSync } = useRequestDirectorySync();

  return (
    <div className="flex items-center gap-2">
      {isVerified && (
        <Button
          onClick={() => requestSync(provider)}
          disabled={isRequestingSync}
          data-testid={SETTINGS_PAGE_HANDLES.DIRECTORY_SYNC_SYNC_NOW_BUTTON}
        >
          <RefreshCw
            className={cn("mr-2 size-4", isRequestingSync && "animate-spin")}
            aria-hidden="true"
          />
          {t("directorySync.actions.syncNow")}
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            aria-label={t("directorySync.actions.more")}
            data-testid={SETTINGS_PAGE_HANDLES.DIRECTORY_SYNC_MORE_ACTIONS}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 p-1">
          <DropdownMenuItem
            className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 text-neutral-900"
            disabled={isVerifying}
            onSelect={() => verifyConnection(provider)}
          >
            <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
            {t("directorySync.actions.verify")}
          </DropdownMenuItem>
          <DropdownMenuSeparator className="my-1 h-px bg-neutral-200" />
          <DropdownMenuItem
            className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 text-error-700 focus:bg-error-50 focus:text-error-800"
            onSelect={() => setIsDisconnectDialogOpen(true)}
            data-testid={SETTINGS_PAGE_HANDLES.DIRECTORY_SYNC_DISCONNECT_BUTTON}
          >
            <Unlink className="size-4 shrink-0" aria-hidden="true" />
            {t("directorySync.actions.disconnect")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DisconnectDirectorySyncDialog
        connection={connection}
        isOpen={isDisconnectDialogOpen}
        onOpenChange={setIsDisconnectDialogOpen}
      />
    </div>
  );
}

type DisconnectDirectorySyncDialogProps = {
  connection: DirectorySyncConnection;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

function DisconnectDirectorySyncDialog({
  connection,
  isOpen,
  onOpenChange,
}: DisconnectDirectorySyncDialogProps) {
  const { t } = useTranslation();
  const { mutateAsync: deleteConnection, isPending } = useDeleteDirectorySyncConnection();

  const disconnectDirectory = async () => {
    await deleteConnection(connection.provider).catch(() => null);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("directorySync.disconnect.title")}</DialogTitle>
          <DialogDescription>{t("directorySync.disconnect.description")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.button.cancel")}
          </Button>
          <Button variant="destructive" onClick={disconnectDirectory} disabled={isPending}>
            {t("directorySync.actions.disconnect")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
