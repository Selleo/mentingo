import {
  AUTOMATION_VALIDATION_ISSUE_CODES,
  AUTOMATION_EMAIL_DELIVERY_STATUSES,
  AUTOMATION_RUN_STATUSES,
  type AutomationEmailDeliverySummary,
} from "@repo/shared";
import { AlertCircle, Mail, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAutomationRun } from "~/api/queries/useAutomationRun";
import { Separator } from "~/components/ui/separator";
import { formatLocalizedDate } from "~/utils/formatLocalizedDate";

import { BranchTimeline } from "../../Builder/components/BranchTimeline";

import { AutomationRunStatusText } from "./AutomationRunStatusText";

export function AutomationRunDetail({ automationRunId }: { automationRunId: string }) {
  const { t, i18n } = useTranslation();
  const { data, isPending, isError } = useAutomationRun(automationRunId);

  if (isPending) {
    return <p>{t("automations.loading")}</p>;
  }

  if (isError || !data) {
    return <p role="alert">{t("automations.requestFailed")}</p>;
  }

  const { run, deliveries } = data;
  const failureReasonCode = run.failureReasonCode;
  const deliveriesByStep = new Map<string, AutomationEmailDeliverySummary[]>();

  for (const delivery of deliveries) {
    const stepDeliveries = deliveriesByStep.get(delivery.stepId) ?? [];

    stepDeliveries.push(delivery);
    deliveriesByStep.set(delivery.stepId, stepDeliveries);
  }

  const steps = [...deliveriesByStep.values()].sort(
    (left, right) => left[0].stepOrder - right[0].stepOrder,
  );

  return (
    <div className="space-y-4 py-2">
      <div className="grid gap-3 text-sm">
        <DetailRow
          label={t("automationLogs.detail.ranAt")}
          value={formatLocalizedDate(i18n.language, run.createdAt, "dd MMM yyyy, HH:mm:ss")}
        />
        <DetailRow label={t("automationLogs.detail.automation")} value={run.automationName} />
        <div className="flex items-start justify-between gap-4">
          <span className="shrink-0 text-muted-foreground">
            {t("automationLogs.detail.status")}
          </span>
          <AutomationRunStatusText status={run.status} />
        </div>
      </div>
      {failureReasonCode && (
        <>
          <Separator />
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div>
                <p className="text-sm font-medium text-destructive">
                  {t("automationLogs.detail.error")}
                </p>
                <p className="mt-1 text-xs text-destructive/80">
                  {t(
                    [
                      `automationBuilder.condition.issues.${failureReasonCode}`,
                      `automationLogs.reasons.${failureReasonCode}`,
                    ],
                    {
                      defaultValue: t("automations.requestFailed"),
                    },
                  )}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
      <Separator />
      <p className="text-sm font-medium">{t("automationLogs.detail.stepsTitle")}</p>
      <ol className="max-h-[400px] overflow-y-auto pr-1">
        <li className="relative pb-6 pl-11 before:absolute before:bottom-0 before:left-4 before:top-9 before:w-px before:bg-neutral-200 last:pb-0 last:before:hidden">
          <span className="absolute left-0 top-0 flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Zap className="size-4" aria-hidden="true" />
          </span>
          <div className="flex min-h-8 items-center justify-between gap-3">
            <p className="text-sm font-medium">{t("automationLogs.detail.triggerEvent")}</p>
            <div className="shrink-0">
              <AutomationRunStatusText
                status={AUTOMATION_RUN_STATUSES.SUCCEEDED}
                label={t("automationLogs.detail.eventReceived")}
              />
            </div>
          </div>
          <p className="mt-1 text-sm text-neutral-600">
            {t(`emailTemplates.events.${run.eventKind}`, { defaultValue: run.eventKind })}
          </p>
        </li>
        {run.steps?.length > 0 ? (
          <li>
            <BranchTimeline
              blocked={
                run.failureReasonCode === AUTOMATION_VALIDATION_ISSUE_CODES.INVALID_CONDITION_VALUE
              }
              steps={run.steps}
              eventKind={run.eventKind}
              deliveries={deliveries}
            />
          </li>
        ) : (
          steps.map((stepDeliveries) => (
            <li
              key={stepDeliveries[0].stepId}
              className="relative pb-6 pl-11 before:absolute before:bottom-0 before:left-4 before:top-9 before:w-px before:bg-neutral-200 last:pb-0 last:before:hidden"
            >
              <span className="absolute left-0 top-0 flex size-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                <Mail className="size-4" aria-hidden="true" />
              </span>
              <div className="flex min-h-8 items-center justify-between gap-3">
                <p className="text-sm font-medium">
                  {t("automationBuilder.simulation.emailAction", {
                    number: stepDeliveries[0].stepOrder + 1,
                  })}
                </p>
                <div className="shrink-0">
                  <AutomationRunStatusText status={getStepStatus(stepDeliveries)} />
                </div>
              </div>
              {[...new Set(stepDeliveries.map((delivery) => delivery.reasonCode))]
                .filter((reasonCode): reasonCode is string => Boolean(reasonCode))
                .map((reasonCode) => (
                  <p
                    key={reasonCode}
                    className="mt-2 break-words rounded-md bg-error-50 px-2 py-1.5 text-xs text-error-700"
                  >
                    {t(`automationLogs.reasons.${reasonCode}`, {
                      defaultValue: t("automations.requestFailed"),
                    })}
                  </p>
                ))}
            </li>
          ))
        )}
      </ol>
      {steps.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("automationLogs.detail.noEmails")}</p>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function getStepStatus(deliveries: AutomationEmailDeliverySummary[]) {
  const statuses = new Set(deliveries.map((delivery) => delivery.status));

  if (statuses.has(AUTOMATION_EMAIL_DELIVERY_STATUSES.PROCESSING))
    return AUTOMATION_EMAIL_DELIVERY_STATUSES.PROCESSING;

  if (statuses.has(AUTOMATION_EMAIL_DELIVERY_STATUSES.RETRYING))
    return AUTOMATION_EMAIL_DELIVERY_STATUSES.RETRYING;

  if (statuses.has(AUTOMATION_EMAIL_DELIVERY_STATUSES.PENDING))
    return AUTOMATION_EMAIL_DELIVERY_STATUSES.PENDING;

  if (statuses.size === 1) return deliveries[0].status;

  return AUTOMATION_RUN_STATUSES.WARNINGS;
}
