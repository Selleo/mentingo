import {
  AUTOMATION_VALIDATION_ISSUE_CODES,
  getCanonicalAutomationField,
  type AutomationSimulationResult,
  type AutomationPlaceholderValue,
  type AutomationProvidedVariable,
  type AutomationEventDefinition,
  type AutomationWorkflow,
  type AutomationSendEmailStep,
} from "@repo/shared";
import { Loader2, Mail, Variable, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

import { getBooleanConditionFieldOptions } from "../utils/conditionFields";
import { getSelectableAutomationVariables } from "../utils/selectableVariables";

import { AutomationSearchSelect } from "./AutomationSearchSelect";
import { BranchTimeline } from "./BranchTimeline";
import { SimulationEmailPreview } from "./SimulationEmailPreview";

interface SimulationPanelProps {
  open: boolean;
  loading: boolean;
  result: AutomationSimulationResult | null;
  event?: AutomationEventDefinition;
  workflow: AutomationWorkflow;
  onClose: () => void;
  sampleValues: Record<string, AutomationPlaceholderValue>;
  onSimulate: (values: Record<string, AutomationPlaceholderValue>) => void;
}

export function SimulationPanel({
  open,
  loading,
  result,
  event,
  workflow,
  onClose,
  onSimulate,
  sampleValues,
}: SimulationPanelProps) {
  const { t } = useTranslation();
  const [scenario, setScenario] =
    useState<Record<string, AutomationPlaceholderValue>>(sampleValues);
  const conditionFields = getBooleanConditionFieldOptions(event).filter((field) =>
    workflow.steps.some(
      (step) =>
        step.type === "condition" &&
        event &&
        getCanonicalAutomationField(event, step.config.field ?? "") ===
          getCanonicalAutomationField(event, field.key),
    ),
  );

  function getSampleValue(variable: AutomationProvidedVariable) {
    const value =
      sampleValues[variable.key] ??
      sampleValues[variable.sourceKey ?? variable.key] ??
      variable.sampleValue;
    if (typeof value === "boolean")
      return t(value ? "automationBuilder.condition.yes" : "automationBuilder.condition.no");
    return typeof value === "string" ? value : JSON.stringify(value, null, 2);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        className="flex max-h-[85dvh] w-[calc(100vw-2rem)] max-w-5xl flex-col gap-0 overflow-hidden rounded-xl p-0"
        noCloseButton
      >
        <DialogHeader className="flex shrink-0 flex-row items-start justify-between gap-3 px-4 py-5 sm:px-6">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <DialogTitle className="text-xl font-semibold">
                {t("automationBuilder.simulation.title")}
              </DialogTitle>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="size-8 shrink-0"
            aria-label={t("automations.close")}
          >
            <X className="size-4" />
          </Button>
        </DialogHeader>
        {conditionFields.length > 0 && (
          <div className="flex flex-wrap items-end gap-3 border-t bg-white px-5 py-3">
            {conditionFields.map((field) => (
              <div key={field.key} className="min-w-48 space-y-1">
                <p className="text-xs text-muted-foreground">
                  {t(field.labelKey, { defaultValue: field.label })}
                </p>
                <AutomationSearchSelect
                  label={t(field.labelKey, { defaultValue: field.label })}
                  placeholder={t("automationBuilder.condition.yes")}
                  value={String(
                    scenario[field.key] ??
                      (event
                        ? scenario[getCanonicalAutomationField(event, field.key)]
                        : undefined) ??
                      true,
                  )}
                  disabled={loading}
                  onValueChange={(value) =>
                    setScenario({ ...scenario, [field.key]: value === "true" })
                  }
                  groups={[
                    {
                      options: [
                        { value: "true", label: t("automationBuilder.condition.yes") },
                        { value: "false", label: t("automationBuilder.condition.no") },
                      ],
                    },
                  ]}
                />
              </div>
            ))}
            <Button size="sm" disabled={loading} onClick={() => onSimulate(scenario)}>
              {t("automationBuilder.condition.tryScenario")}
            </Button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-auto border-t bg-neutral-50">
          {loading && (
            <div
              role="status"
              className="flex h-full flex-col items-center justify-center gap-4 p-8"
            >
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t("automations.loading")}</p>
            </div>
          )}
          {!loading && !result && (
            <p role="alert" className="p-4 sm:p-6">
              {t("automations.requestFailed")}
            </p>
          )}
          {!loading && result && (
            <Tabs defaultValue="preview" className="flex flex-col">
              {result.issues.length > 0 && (
                <Alert
                  variant="destructive"
                  className="mx-4 mt-4 w-auto border-error-200 bg-error-50 sm:mx-6"
                >
                  <AlertDescription>
                    <p className="mb-2 text-sm font-semibold">
                      {t("automationBuilder.simulation.errorsTitle")}
                    </p>
                    <ul className="list-disc space-y-1 pl-4 text-sm">
                      {result.issues.map((issue, index) => (
                        <li key={`${issue.stepId}:${issue.code}:${index}`}>
                          {t(`automationBuilder.condition.issues.${issue.code}`, {
                            defaultValue: t("automations.errors.invalidWorkflow"),
                          })}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              <TabsList className="grid h-auto grid-cols-3 justify-start rounded-none border-b bg-white p-0">
                <TabsTrigger
                  className="min-w-0 rounded-none border-b-2 border-transparent px-2 py-3 text-xs text-neutral-500 data-[state=active]:border-primary-700 data-[state=active]:bg-transparent data-[state=active]:shadow-none sm:px-4 sm:text-sm"
                  value="preview"
                >
                  <Mail className="mr-1.5 size-3.5" />
                  {t("automationBuilder.simulation.tabPreview")}
                </TabsTrigger>
                <TabsTrigger
                  className="min-w-0 rounded-none border-b-2 border-transparent px-2 py-3 text-xs text-neutral-500 data-[state=active]:border-primary-700 data-[state=active]:bg-transparent data-[state=active]:shadow-none sm:px-4 sm:text-sm"
                  value="eventData"
                >
                  <Variable className="mr-1.5 size-3.5" />
                  {t("automationBuilder.simulation.tabEventData")}
                </TabsTrigger>
                <TabsTrigger
                  className="min-w-0 rounded-none border-b-2 border-transparent px-2 py-3 text-xs text-neutral-500 data-[state=active]:border-primary-700 data-[state=active]:bg-transparent data-[state=active]:shadow-none sm:px-4 sm:text-sm"
                  value="mappings"
                >
                  {t("automationBuilder.simulation.tabMappings")}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="preview" className="m-0 min-h-0 flex-1">
                <div className="space-y-0">
                  {workflow.steps.some((step) => step.type === "condition") &&
                    result.steps.length > 0 && (
                      <div className="border-b bg-white p-5">
                        <BranchTimeline
                          blocked={result.issues.some(
                            (issue) =>
                              issue.code ===
                              AUTOMATION_VALIDATION_ISSUE_CODES.INVALID_CONDITION_VALUE,
                          )}
                          steps={result.steps}
                          eventKind={event?.kind}
                        />
                      </div>
                    )}
                  {result.previews.length === 0 && (
                    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-white px-4 py-12 text-center text-neutral-500">
                      <Mail className="size-8 text-neutral-400" />
                      <p className="text-sm">
                        {t(
                          result.issues.length
                            ? "automationBuilder.simulation.preview.unavailable"
                            : "automationBuilder.condition.noEmail",
                        )}
                      </p>
                    </div>
                  )}
                  {result.previews.map((preview) => (
                    <article key={preview.stepId} className="overflow-hidden border-b bg-white">
                      <div className="space-y-3 border-b px-4 py-4 sm:px-5">
                        <div className="flex items-center gap-2 text-xs font-medium leading-none text-neutral-500">
                          <Mail className="block size-4 shrink-0" aria-hidden="true" />
                          <span>
                            {t("automationBuilder.simulation.emailAction", {
                              number:
                                result.steps
                                  .filter((step) => step.type === "send_email")
                                  .findIndex((step) => step.stepId === preview.stepId) + 1,
                            })}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <h3 className="break-words text-base font-semibold text-neutral-950">
                            {t("automationBuilder.simulation.subject")} {preview.subject}
                          </h3>
                          {preview.sampleRecipient && (
                            <p className="break-words text-xs text-neutral-500">
                              {t("automationBuilder.simulation.to")}{" "}
                              {preview.sampleRecipient.name && `${preview.sampleRecipient.name} · `}
                              {preview.sampleRecipient.email}
                            </p>
                          )}
                        </div>
                      </div>
                      <SimulationEmailPreview html={preview.html} subject={preview.subject} />
                    </article>
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="eventData" className="m-0 min-h-0 flex-1">
                <div>
                  <Card className="rounded-none border-0 shadow-none">
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader className="bg-neutral-50">
                          <TableRow>
                            <TableHead>{t("automationBuilder.simulation.variableName")}</TableHead>
                            <TableHead>{t("automationBuilder.simulation.variableLabel")}</TableHead>
                            <TableHead>{t("automationBuilder.simulation.sampleValue")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {getSelectableAutomationVariables(event).map((variable) => (
                            <TableRow key={variable.key}>
                              <TableCell>
                                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{`{{${variable.key}}}`}</code>
                              </TableCell>
                              <TableCell>
                                {variable.labelKey
                                  ? t(variable.labelKey, { defaultValue: variable.label })
                                  : variable.label}
                              </TableCell>
                              <TableCell className="max-w-sm whitespace-pre-wrap break-words text-sm text-neutral-600">
                                {getSampleValue(variable)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              <TabsContent value="mappings" className="m-0 min-h-0 flex-1">
                <div className="space-y-0">
                  {workflow.steps
                    .filter((step): step is AutomationSendEmailStep => step.type === "send_email")
                    .map((step) => (
                      <Card key={step.id} className="rounded-none border-0 border-b shadow-none">
                        <CardContent className="p-0">
                          <Table>
                            <TableHeader className="bg-neutral-50">
                              <TableRow>
                                <TableHead>
                                  {t("automationBuilder.simulation.placeholder")}
                                </TableHead>
                                <TableHead>{t("automationBuilder.simulation.mappedTo")}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {Object.entries(step.config.mappings ?? {}).map(
                                ([placeholder, mapping]) => (
                                  <TableRow key={placeholder}>
                                    <TableCell>
                                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{`{{${placeholder}}}`}</code>
                                    </TableCell>
                                    <TableCell>
                                      {mapping.type === "event_field"
                                        ? `{{${mapping.field}}}`
                                        : JSON.stringify(mapping.value)}
                                    </TableCell>
                                  </TableRow>
                                ),
                              )}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
