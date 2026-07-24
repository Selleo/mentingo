import { useSearchParams } from "@remix-run/react";
import {
  MICROSOFT_CALENDAR_CONNECTION_STATUSES,
  MICROSOFT_CALENDAR_OAUTH_RESULTS,
} from "@repo/shared";
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  Link2,
  RefreshCw,
  RotateCcw,
  Unplug,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useDisconnectMicrosoftCalendar } from "~/api/mutations/calendar/useDisconnectMicrosoftCalendar";
import { useSetMicrosoftCalendarOutboundSync } from "~/api/mutations/calendar/useSetMicrosoftCalendarOutboundSync";
import { useSyncMicrosoftCalendar } from "~/api/mutations/calendar/useSyncMicrosoftCalendar";
import { useMicrosoftCalendarConnection } from "~/api/queries/calendar/useMicrosoftCalendarConnection";
import { Icon } from "~/components/Icon";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Switch } from "~/components/ui/switch";
import { useToast } from "~/components/ui/use-toast";
import { cn } from "~/lib/utils";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { baseUrl } from "~/utils/baseUrl";

import { SETTINGS_PAGE_HANDLES } from "../../../../../e2e/data/settings/handles";

const formatDateTime = (value: string | null, locale: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
};

export function MicrosoftCalendarCard() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const language = useLanguageStore((state) => state.language);

  const [searchParams, setSearchParams] = useSearchParams();
  const [isDisconnectOpen, setIsDisconnectOpen] = useState(false);
  const [isReplaceOpen, setIsReplaceOpen] = useState(false);

  const { data: connection, isLoading } = useMicrosoftCalendarConnection();
  const { mutateAsync: syncCalendar, isPending: isSyncPending } = useSyncMicrosoftCalendar();
  const { mutateAsync: disconnectCalendar, isPending: isDisconnectPending } =
    useDisconnectMicrosoftCalendar();
  const { mutateAsync: setOutboundSync, isPending: isOutboundPending } =
    useSetMicrosoftCalendarOutboundSync();

  useEffect(() => {
    const result = searchParams.get("microsoftCalendar");
    if (!result) return;

    const isSuccess = result === MICROSOFT_CALENDAR_OAUTH_RESULTS.CONNECTED;
    toast({
      variant: isSuccess ? "default" : "destructive",
      description: t(`microsoftCalendar.oauth.${result}`, {
        defaultValue: t("microsoftCalendar.oauth.authorization_failed"),
      }),
    });
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("microsoftCalendar");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams, t, toast]);

  if (isLoading || !connection?.available) return null;

  const isDisconnected = connection.status === "disconnected";
  const isSyncing = connection.status === MICROSOFT_CALENDAR_CONNECTION_STATUSES.SYNCING;
  const reconnectRequired =
    connection.status === MICROSOFT_CALENDAR_CONNECTION_STATUSES.RECONNECT_REQUIRED;
  const hasError =
    connection.status === MICROSOFT_CALENDAR_CONNECTION_STATUSES.ERROR || reconnectRequired;
  let errorTitle = t("microsoftCalendar.stale.title");
  let errorDescription = t("microsoftCalendar.stale.description");
  if (connection.errorCode === "admin_approval_required") {
    errorTitle = t("microsoftCalendar.adminApproval.title");
    errorDescription = t("microsoftCalendar.adminApproval.description");
  }

  const startAuthorization = (replace = false) => {
    const url = new URL(`${baseUrl}/api/auth/microsoft-calendar`);
    url.searchParams.set("replace", String(replace));
    url.searchParams.set("outbound", "true");
    window.location.assign(url.toString());
  };

  const disconnect = async () => {
    await disconnectCalendar();
    setIsDisconnectOpen(false);
  };

  const renderPrimaryAction = () => {
    if (isDisconnected) {
      return (
        <Button
          variant="outline"
          onClick={() => startAuthorization()}
          data-testid={SETTINGS_PAGE_HANDLES.MICROSOFT_CALENDAR_CONNECT}
        >
          <Link2 className="mr-2 size-4" aria-hidden="true" />
          {t("microsoftCalendar.action.connect")}
        </Button>
      );
    }

    if (reconnectRequired) {
      return (
        <Button
          variant="outline"
          onClick={() => startAuthorization()}
          data-testid={SETTINGS_PAGE_HANDLES.MICROSOFT_CALENDAR_RECONNECT}
        >
          <RotateCcw className="mr-2 size-4" aria-hidden="true" />
          {t("microsoftCalendar.action.reconnect")}
        </Button>
      );
    }

    return (
      <Button
        variant="outline"
        disabled={isSyncing || isSyncPending}
        onClick={() => syncCalendar()}
        data-testid={SETTINGS_PAGE_HANDLES.MICROSOFT_CALENDAR_SYNC}
      >
        <RefreshCw className={cn("mr-2 size-4", isSyncing && "animate-spin")} />
        {t("microsoftCalendar.action.sync")}
      </Button>
    );
  };

  const toggleOutboundSync = async (enabled: boolean) => {
    await setOutboundSync(enabled);
  };

  return (
    <Card
      className="overflow-hidden border-[#0078d4]/25"
      data-testid={SETTINGS_PAGE_HANDLES.MICROSOFT_CALENDAR_CARD}
    >
      <div className="h-1 bg-[#0078d4]" />
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#e8f3fb]">
              <Icon name="Microsoft" className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <CardTitle className="h5">{t("microsoftCalendar.title")}</CardTitle>
              <CardDescription className="body-lg-md mt-1">
                {t("microsoftCalendar.description")}
              </CardDescription>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "capitalize",
              connection.status === MICROSOFT_CALENDAR_CONNECTION_STATUSES.CONNECTED &&
                "border-[#0078d4]/30 bg-[#e8f3fb] text-[#005a9e]",
              hasError && "border-error-200 bg-error-50 text-error-800",
            )}
          >
            {isSyncing && <RefreshCw className="mr-1.5 size-3 animate-spin" />}
            {t(`microsoftCalendar.status.${connection.status}`)}
          </Badge>
        </div>
      </CardHeader>

      {!isDisconnected && (
        <CardContent className="space-y-4">
          {hasError && (
            <div className="flex gap-3 rounded-lg border border-error-200 bg-error-50 p-4 text-error-900">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <div className="space-y-1 text-sm">
                <p className="font-semibold">{errorTitle}</p>
                <p>{errorDescription}</p>
              </div>
            </div>
          )}

          <dl className="grid gap-4 rounded-lg bg-neutral-50 p-4 md:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {t("microsoftCalendar.account")}
              </dt>
              <dd className="mt-1 truncate text-sm font-medium text-neutral-950">
                {connection.accountEmail}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {t("microsoftCalendar.lastSync")}
              </dt>
              <dd className="mt-1 text-sm font-medium text-neutral-950">
                {formatDateTime(connection.lastSuccessfulSyncAt, language)}
              </dd>
            </div>
          </dl>
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div className="min-w-0">
              <label
                htmlFor="microsoft-calendar-outbound-switch"
                className="text-sm font-semibold text-neutral-950"
              >
                {t("microsoftCalendar.outbound.title")}
              </label>
              {!connection.outboundSyncEnabled && connection.status !== "disconnected" && (
                <p className="mt-1 text-xs text-neutral-500">
                  {t("microsoftCalendar.outbound.reauthorize")}
                </p>
              )}
            </div>
            <Switch
              id="microsoft-calendar-outbound-switch"
              checked={connection.outboundSyncEnabled}
              disabled={isOutboundPending || reconnectRequired}
              onCheckedChange={toggleOutboundSync}
              aria-label={t("microsoftCalendar.outbound.title")}
            />
          </div>
        </CardContent>
      )}

      <CardFooter className="flex flex-wrap gap-2 border-t py-4">
        {renderPrimaryAction()}
        {!isDisconnected && (
          <>
            <Button
              variant="outline"
              onClick={() => setIsReplaceOpen(true)}
              data-testid={SETTINGS_PAGE_HANDLES.MICROSOFT_CALENDAR_REPLACE}
            >
              <ArrowLeftRight className="mr-2 size-4" aria-hidden="true" />
              {t("microsoftCalendar.action.replace")}
            </Button>
            <Button
              variant="outline"
              className="text-error-700 hover:bg-error-50 hover:text-error-800"
              onClick={() => setIsDisconnectOpen(true)}
              data-testid={SETTINGS_PAGE_HANDLES.MICROSOFT_CALENDAR_DISCONNECT}
            >
              <Unplug className="mr-2 size-4" aria-hidden="true" />
              {t("microsoftCalendar.action.disconnect")}
            </Button>
          </>
        )}
      </CardFooter>

      <Dialog open={isDisconnectOpen} onOpenChange={setIsDisconnectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("microsoftCalendar.disconnect.title")}</DialogTitle>
            <DialogDescription>{t("microsoftCalendar.disconnect.description")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDisconnectOpen(false)}>
              {t("common.button.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={isDisconnectPending}
              onClick={disconnect}
              data-testid={SETTINGS_PAGE_HANDLES.MICROSOFT_CALENDAR_DISCONNECT_CONFIRM}
            >
              <Unplug className="mr-2 size-4" aria-hidden="true" />
              {t("microsoftCalendar.action.disconnect")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isReplaceOpen} onOpenChange={setIsReplaceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("microsoftCalendar.replace.title")}</DialogTitle>
            <DialogDescription>
              {t("microsoftCalendar.replace.description", { email: connection.accountEmail })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReplaceOpen(false)}>
              {t("common.button.cancel")}
            </Button>
            <Button variant="outline" onClick={() => startAuthorization(true)}>
              <ArrowRight className="mr-2 size-4" aria-hidden="true" />
              {t("microsoftCalendar.action.continue")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
