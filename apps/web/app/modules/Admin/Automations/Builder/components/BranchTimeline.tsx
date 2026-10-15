import { AUTOMATION_EVENT_VARIABLES, resolveAutomationEventFieldSourceKey } from "@repo/shared";
import { GitBranch, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

import { AutomationRunStatusText } from "../../Runs/components/AutomationRunStatusText";

import type {
  AutomationStepTrace,
  AutomationEmailDeliverySummary,
  AutomationEventKind,
} from "@repo/shared";

export function BranchTimeline({
  steps,
  eventKind,
  deliveries,
  blocked = false,
  executedOnly = false,
}: {
  steps: AutomationStepTrace[];
  eventKind?: AutomationEventKind;
  deliveries?: AutomationEmailDeliverySummary[];
  blocked?: boolean;
  executedOnly?: boolean;
}) {
  const { t } = useTranslation();
  const variables = eventKind ? AUTOMATION_EVENT_VARIABLES[eventKind] : [];
  let emailNumber = 0;

  return (
    <ol className="space-y-0">
      {steps
        .filter((step) => step.type !== "trigger")
        .map((step) => {
          const isCondition = step.type === "condition";
          if (!isCondition) emailNumber++;
          if (executedOnly && !step.matchedCount && !step.failedCount) return null;
          const variable = variables?.find(
            (variable) =>
              variable.key === step.field ||
              (eventKind &&
                step.field &&
                variable.sourceKey === resolveAutomationEventFieldSourceKey(eventKind, step.field)),
          );
          const stepDeliveries = deliveries?.filter((delivery) => delivery.stepId === step.stepId);
          const statuses = new Set(stepDeliveries?.map((delivery) => delivery.status));
          let status: AutomationEmailDeliverySummary["status"] | "warnings" = "succeeded";
          let label: string | undefined;
          if (step.failedCount) status = "failed";
          else if (!step.matchedCount) {
            status = "cancelled";
            label = t("automationBuilder.condition.skipped");
          } else if (blocked && !isCondition) {
            status = "cancelled";
            label = t("automations.executionStatuses.cancelled");
          } else if (statuses.has("processing")) status = "processing";
          else if (statuses.has("retrying")) status = "retrying";
          else if (statuses.has("pending")) status = "pending";
          else if (statuses.size > 1) status = "warnings";
          else if (stepDeliveries?.length) status = stepDeliveries[0].status;
          else if (isCondition) label = t("automationBuilder.condition.checked");
          else if (deliveries) label = t("automationBuilder.condition.noRecipients");
          else label = t("automationBuilder.condition.wouldSend");

          let branch = "";
          if (step.trueCount && step.falseCount) branch = t("automationBuilder.condition.both");
          else if (step.trueCount) branch = t("automationBuilder.condition.yes");
          else if (step.falseCount) branch = t("automationBuilder.condition.no");

          return (
            <li
              key={step.stepId}
              className="relative pb-5 pl-11 before:absolute before:bottom-0 before:left-4 before:top-9 before:w-px before:bg-neutral-200 last:pb-0 last:before:hidden"
            >
              <span
                className={cn(
                  "absolute left-0 top-0 flex size-8 items-center justify-center rounded-lg",
                  {
                    "bg-amber-50 text-amber-700": isCondition,
                    "bg-violet-50 text-violet-600": !isCondition,
                  },
                )}
              >
                {isCondition ? <GitBranch className="size-4" /> : <Mail className="size-4" />}
              </span>
              <div className="flex min-h-8 items-center justify-between gap-3">
                <p className="text-sm font-medium">
                  {isCondition
                    ? t("automationBuilder.condition.title")
                    : t("automationBuilder.simulation.emailAction", { number: emailNumber })}
                </p>
                <AutomationRunStatusText status={status} label={label} />
              </div>
              {isCondition && (
                <p className="mt-1 text-sm text-neutral-600">
                  {variable?.labelKey
                    ? t(variable.labelKey)
                    : t(`automationBuilder.variables.${step.field}`, { defaultValue: step.field })}
                  {branch && ` · ${branch}`}
                </p>
              )}
              {step.matchedCount > 0 && step.skippedCount > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("automationBuilder.condition.partiallySkipped")}
                </p>
              )}
              {[...new Set(stepDeliveries?.map((delivery) => delivery.reasonCode))]
                .filter(Boolean)
                .map((reason) => (
                  <p key={reason} className="mt-2 text-xs text-destructive">
                    {t(`automationLogs.reasons.${reason}`, {
                      defaultValue: t("automations.requestFailed"),
                    })}
                  </p>
                ))}
            </li>
          );
        })}
    </ol>
  );
}
