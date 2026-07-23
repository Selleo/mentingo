import { CheckCircle2, Globe, Mail, MailX, SkipForward, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";

import type { AutomationLogEntry, LogEmailEntry } from "../automationLogs.types";
import type { FC } from "react";

interface LogDetailContentProps {
  log: AutomationLogEntry;
}

export const LogDetailContent: FC<LogDetailContentProps> = ({ log }) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 py-2">
      <div className="grid gap-3 text-sm">
        <DetailRow label={t("automationLogs.detail.ranAt")} value={log.ranAt} />
        <DetailRow label={t("automationLogs.detail.triggerEvent")} value={log.triggerEvent} />
        <DetailRow label={t("automationLogs.detail.automation")} value={log.automationName} />
        <DetailRow label={t("automationLogs.detail.duration")} value={log.duration} />
      </div>

      <Separator />

      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t("automationLogs.detail.emailsTitle", { count: log.emails.length })}
      </p>

      <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
        {log.emails.map((email, index) => (
          <EmailEntryCard key={index} email={email} />
        ))}
      </div>
    </div>
  );
};

const EmailEntryCard: FC<{ email: LogEmailEntry }> = ({ email }) => {
  const { t } = useTranslation();

  const getStatusIcon = (status: LogEmailEntry["status"]) => {
    switch (status) {
      case "sent":
        return <CheckCircle2 className="size-4 text-success-600" />;
      case "skipped":
        return <SkipForward className="size-4 text-warning-600" />;
      case "failed":
        return <XCircle className="size-4 text-destructive" />;
    }
  };

  const getStatusBadgeVariant = (status: LogEmailEntry["status"]) => {
    switch (status) {
      case "sent":
        return "success" as const;
      case "skipped":
        return "inProgress" as const;
      case "failed":
        return "destructive" as const;
    }
  };

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {getStatusIcon(email.status)}
          <span className="truncate text-sm font-medium">{email.recipientName}</span>
        </div>
        <Badge variant={getStatusBadgeVariant(email.status)}>
          {t(`automationLogs.status.${email.status}`)}
        </Badge>
      </div>

      <div className="grid gap-1.5 text-xs text-muted-foreground pl-6">
        <span>{email.recipientEmail}</span>
        {email.templateName && (
          <span className="flex items-center gap-1">
            <Mail className="size-3" /> {email.templateName}
          </span>
        )}
        {email.language && (
          <span className="flex items-center gap-1">
            <Globe className="size-3" /> {email.language.toUpperCase()}
          </span>
        )}
      </div>

      {email.skipReason && (
        <div className="rounded-md border border-warning-200 bg-warning-50 p-2 ml-6">
          <div className="flex items-start gap-1.5">
            <SkipForward className="mt-0.5 size-3.5 shrink-0 text-warning-600" />
            <p className="text-xs text-warning-700">{email.skipReason}</p>
          </div>
        </div>
      )}

      {email.failReason && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 ml-6">
          <div className="flex items-start gap-1.5">
            <MailX className="mt-0.5 size-3.5 shrink-0 text-destructive" />
            <p className="text-xs text-destructive/80">{email.failReason}</p>
          </div>
        </div>
      )}
    </div>
  );
};

const DetailRow: FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-start justify-between gap-4">
    <span className="shrink-0 text-muted-foreground">{label}</span>
    <span className="text-right font-medium">{value}</span>
  </div>
);
