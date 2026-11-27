import { useSearchParams } from "@remix-run/react";
import {
  CALENDAR_CONNECTION_PUBLIC_STATUSES,
  CALENDAR_CONNECTION_STATUSES,
  GOOGLE_CALENDAR_OAUTH_RESULTS,
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

import { useDisconnectGoogleCalendar } from "~/api/mutations/calendar/useDisconnectGoogleCalendar";
import { useSetGoogleCalendarOutboundSync } from "~/api/mutations/calendar/useSetGoogleCalendarOutboundSync";
import { useSyncGoogleCalendar } from "~/api/mutations/calendar/useSyncGoogleCalendar";
import { useGoogleCalendarConnection } from "~/api/queries/calendar/useGoogleCalendarConnection";
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

const GOOGLE_CALENDAR_DELETED_ERROR_CODE = "calendar_deleted";

const formatDateTime = (value: string | null, locale: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
};

export function GoogleCalendarCard() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const language = useLanguageStore((state) => state.language);

  const [searchParams, setSearchParams] = useSearchParams();
  const [isDisconnectOpen, setIsDisconnectOpen] = useState(false);
  const [isReplaceOpen, setIsReplaceOpen] = useState(false);

  const { data: connection, isLoading } = useGoogleCalendarConnection();
  const { mutateAsync: syncCalendar, isPending: isSyncPending } = useSyncGoogleCalendar();
  const { mutateAsync: disconnectCalendar, isPending: isDisconnectPending } =
    useDisconnectGoogleCalendar();
  const { mutateAsync: setOutboundSync, isPending: isOutboundPending } =
    useSetGoogleCalendarOutboundSync();

  useEffect(() => {
    const result = searchParams.get("googleCalendar");
    if (!result) return;

    const isSuccess = result === GOOGLE_CALENDAR_OAUTH_RESULTS.CONNECTED;
    toast({
      variant: isSuccess ? "default" : "destructive",
      description: t(`googleCalendar.oauth.${result}`, {
        defaultValue: t("googleCalendar.oauth.authorization_failed"),
      }),
    });
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("googleCalendar");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams, t, toast]);

  if (isLoading || !connection?.available) return null;

  const isDisconnected = connection.status === CALENDAR_CONNECTION_PUBLIC_STATUSES.DISCONNECTED;
  const isSyncing = connection.status === CALENDAR_CONNECTION_STATUSES.SYNCING;
  const reconnectRequired = connection.status === CALENDAR_CONNECTION_STATUSES.RECONNECT_REQUIRED;
  const hasError = connection.status === CALENDAR_CONNECTION_STATUSES.ERROR || reconnectRequired;
  const isManagedCalendarDeleted =
    connection.outboundErrorCode === GOOGLE_CALENDAR_DELETED_ERROR_CODE;

  const startAuthorization = (replace = false) => {
    const url = new URL(`${baseUrl}/api/auth/google-calendar`);
    url.searchParams.set("replace", String(replace));
    window.location.assign(url.toString());
  };

  const disconnect = async () => {
    await disconnectCalendar();
    setIsDisconnectOpen(false);
  };

  const toggleOutboundSync = async (enabled: boolean) => {
    await setOutboundSync(enabled);
  };

  const renderPrimaryAction = () => {
    if (isDisconnected) {
      return (
        <Button
          variant="outline"
          onClick={() => startAuthorization()}
          data-testid={SETTINGS_PAGE_HANDLES.GOOGLE_CALENDAR_CONNECT}
        >
          <Link2 className="mr-2 size-4" aria-hidden="true" />
          {t("googleCalendar.action.connect")}
        </Button>
      );
    }

    if (reconnectRequired) {
      return (
        <Button
          variant="outline"
          onClick={() => startAuthorization()}
          data-testid={SETTINGS_PAGE_HANDLES.GOOGLE_CALENDAR_RECONNECT}
        >
          <RotateCcw className="mr-2 size-4" aria-hidden="true" />
          {t("googleCalendar.action.reconnect")}
        </Button>
      );
    }

    return (
      <Button
        variant="outline"
        disabled={isSyncing || isSyncPending}
        onClick={() => syncCalendar()}
        data-testid={SETTINGS_PAGE_HANDLES.GOOGLE_CALENDAR_SYNC}
      >
        <RefreshCw className={cn("mr-2 size-4", isSyncing && "animate-spin")} />
        {t("googleCalendar.action.sync")}
      </Button>
    );
  };

  return (
    <Card
      className="overflow-hidden border-[#188038]/25"
      data-testid={SETTINGS_PAGE_HANDLES.GOOGLE_CALENDAR_CARD}
    >
      <div className="h-1 bg-[#188038]" />
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#e6f4ea]">
              <Icon name="Google" className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <CardTitle className="h5">{t("googleCalendar.title")}</CardTitle>
              <CardDescription className="body-lg-md mt-1">
                {t("googleCalendar.description")}
              </CardDescription>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "capitalize",
              connection.status === CALENDAR_CONNECTION_STATUSES.CONNECTED &&
                "border-[#188038]/30 bg-[#e6f4ea] text-[#0d652d]",
              hasError && "border-error-200 bg-error-50 text-error-800",
            )}
          >
            {isSyncing && <RefreshCw className="mr-1.5 size-3 animate-spin" />}
            {t(`googleCalendar.status.${connection.status}`)}
          </Badge>
        </div>
      </CardHeader>

      {!isDisconnected && (
        <CardContent className="space-y-4">
          {hasError && (
            <div className="flex gap-3 rounded-lg border border-error-200 bg-error-50 p-4 text-error-900">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <div className="space-y-1 text-sm">
                <p className="font-semibold">{t("googleCalendar.stale.title")}</p>
                <p>{t("googleCalendar.stale.description")}</p>
              </div>
            </div>
          )}

          <dl className="grid gap-4 rounded-lg bg-neutral-50 p-4 md:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {t("googleCalendar.account")}
              </dt>
              <dd className="mt-1 truncate text-sm font-medium text-neutral-950">
                {connection.accountEmail}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {t("googleCalendar.lastSync")}
              </dt>
              <dd className="mt-1 text-sm font-medium text-neutral-950">
                {formatDateTime(connection.lastSuccessfulSyncAt, language)}
              </dd>
            </div>
          </dl>
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <div className="min-w-0">
              <label
                htmlFor="google-calendar-outbound-switch"
                className="text-sm font-semibold text-neutral-950"
              >
                {t("googleCalendar.outbound.title")}
              </label>
              <p className="mt-1 text-xs text-neutral-500">
                {t("googleCalendar.outbound.description")}
              </p>
              {isManagedCalendarDeleted && (
                <p className="mt-1 text-xs text-error-700">
                  {t("googleCalendar.outbound.calendarDeleted")}
                </p>
              )}
            </div>
            <Switch
              id="google-calendar-outbound-switch"
              checked={connection.outboundSyncEnabled}
              disabled={isOutboundPending || reconnectRequired}
              onCheckedChange={toggleOutboundSync}
              aria-label={t("googleCalendar.outbound.title")}
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
              data-testid={SETTINGS_PAGE_HANDLES.GOOGLE_CALENDAR_REPLACE}
            >
              <ArrowLeftRight className="mr-2 size-4" aria-hidden="true" />
              {t("googleCalendar.action.replace")}
            </Button>
            <Button
              variant="outline"
              className="text-error-700 hover:bg-error-50 hover:text-error-800"
              onClick={() => setIsDisconnectOpen(true)}
              data-testid={SETTINGS_PAGE_HANDLES.GOOGLE_CALENDAR_DISCONNECT}
            >
              <Unplug className="mr-2 size-4" aria-hidden="true" />
              {t("googleCalendar.action.disconnect")}
            </Button>
          </>
        )}
      </CardFooter>

      <Dialog open={isDisconnectOpen} onOpenChange={setIsDisconnectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("googleCalendar.disconnect.title")}</DialogTitle>
            <DialogDescription>{t("googleCalendar.disconnect.description")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDisconnectOpen(false)}>
              {t("common.button.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={isDisconnectPending}
              onClick={disconnect}
              data-testid={SETTINGS_PAGE_HANDLES.GOOGLE_CALENDAR_DISCONNECT_CONFIRM}
            >
              <Unplug className="mr-2 size-4" aria-hidden="true" />
              {t("googleCalendar.action.disconnect")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isReplaceOpen} onOpenChange={setIsReplaceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("googleCalendar.replace.title")}</DialogTitle>
            <DialogDescription>
              {t("googleCalendar.replace.description", { email: connection.accountEmail })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReplaceOpen(false)}>
              {t("common.button.cancel")}
            </Button>
            <Button variant="outline" onClick={() => startAuthorization(true)}>
              <ArrowRight className="mr-2 size-4" aria-hidden="true" />
              {t("googleCalendar.action.continue")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
