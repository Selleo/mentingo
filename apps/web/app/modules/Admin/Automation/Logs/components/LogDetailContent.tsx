import { AlertCircle, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Separator } from "~/components/ui/separator";

import { LogStatusBadge } from "./LogStatusBadge";

import type { AutomationLogEntry } from "../automationLogs.types";
import type { FC } from "react";

interface LogDetailContentProps {
  log: AutomationLogEntry;
}

export const LogDetailContent: FC<LogDetailContentProps> = ({ log }) => {
  const { t, i18n } = useTranslation();

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat(i18n.language, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(dateString));
  };

  return (
    <div className="space-y-4 py-2">
      <div className="grid gap-3 text-sm">
        <DetailRow label={t("automationLogs.detail.ranAt")} value={formatDate(log.ranAt)} />
        <DetailRow label={t("automationLogs.detail.triggerEvent")} value={log.triggerEvent} />
        <DetailRow label={t("automationLogs.detail.automation")} value={log.automationName} />
        <div className="flex items-start justify-between gap-4">
          <span className="shrink-0 text-muted-foreground">
            {t("automationLogs.detail.status")}
          </span>
          <LogStatusBadge status={log.status} />
        </div>
      </div>

      {log.errorName && (
        <>
          <Separator />
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div>
                <p className="text-sm font-medium text-destructive">
                  {t("automationLogs.detail.error")}
                </p>
                <p className="mt-1 text-xs text-destructive/80">{log.errorName}</p>
              </div>
            </div>
          </div>
        </>
      )}

      <Separator />

      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t("automationLogs.detail.emailsTitle", { count: log.emailAddresses.length })}
      </p>

      <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
        {log.emailAddresses.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("automationLogs.detail.noEmails")}</p>
        )}
        {log.emailAddresses.map((email, index) => (
          <div key={index} className="flex items-center gap-2 rounded-md border p-2">
            <Mail className="size-4 text-muted-foreground" />
            <span className="text-sm">{email}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const DetailRow: FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-start justify-between gap-4">
    <span className="shrink-0 text-muted-foreground">{label}</span>
    <span className="text-right font-medium">{value}</span>
  </div>
);
