import { Trash2, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";

import { AutomationSearchSelect } from "./AutomationSearchSelect";
import { ConditionSettings } from "./ConditionSettings";
import { EmailActionSettings } from "./EmailActionSettings";

import type { AutomationTemplateOption } from "../../automations.types";
import type {
  AutomationEventDefinition,
  AutomationEventKind,
  AutomationStep,
  AutomationWorkflow,
} from "@repo/shared";

interface EditNodePanelProps {
  node?: AutomationStep;
  workflow: AutomationWorkflow;
  branchPosition?: number;
  label: string;
  events: AutomationEventDefinition[];
  event?: AutomationEventDefinition;
  templates: AutomationTemplateOption[];
  loadingTemplates: boolean;
  readonly: boolean;
  onClose: () => void;
  onConfigurationValidityChange: (valid: boolean) => void;
  onChangeTrigger: (kind: AutomationEventKind) => void;
  onSaveStep: (step: AutomationStep) => void;
  onRemove: (id: string) => void;
}

export function EditNodePanel(props: EditNodePanelProps) {
  const { node, readonly } = props;
  const { t } = useTranslation();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingTrigger, setPendingTrigger] = useState<AutomationEventKind | null>(null);

  if (!node)
    return (
      <aside className="hidden w-96 shrink-0 space-y-3 border-l bg-white p-4 xl:block">
        <h3 className="text-sm font-semibold">{t("automations.configuration")}</h3>
        <p className="text-sm text-neutral-500">{t("automationBuilder.creation.selectStep")}</p>
      </aside>
    );

  const isTrigger = node.type === "trigger";
  let panelTitle = "automationBuilder.editPanel.editAction";
  if (isTrigger) panelTitle = "automationBuilder.editPanel.editTrigger";
  else if (node.type === "condition") panelTitle = "automationBuilder.condition.title";

  return (
    <>
      <aside className="absolute right-0 top-0 z-10 h-full w-96 max-w-full shrink-0 border-l bg-white shadow-lg xl:static xl:shadow-none">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-4 py-3">
            <h3 className="text-sm font-semibold">{t(panelTitle)}</h3>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={props.onClose}
              aria-label={t("automations.close")}
            >
              <X className="size-4" />
            </Button>
          </div>
          <Separator />
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-4">
              {node.type === "trigger" && (
                <div className="space-y-2">
                  <Label>{t("automationBuilder.editPanel.nodeType")}</Label>
                  <div
                    className={cn("rounded-md border px-3 py-2 text-sm", {
                      "border-blue-200 bg-blue-50 text-blue-700": isTrigger,
                      "border-violet-200 bg-violet-50 text-violet-700": !isTrigger,
                    })}
                  >
                    {props.label}
                  </div>
                </div>
              )}
              {node.type === "trigger" && (
                <>
                  <div className="space-y-2">
                    <Label>{t("automationBuilder.editPanel.changeTriggerLabel")}</Label>
                    <AutomationSearchSelect
                      label={t("automationBuilder.editPanel.changeTriggerLabel")}
                      placeholder={t("automations.selectEvent")}
                      disabled={readonly}
                      value={node.config.eventKind ?? ""}
                      onValueChange={(value) => {
                        if (value !== node.config.eventKind)
                          setPendingTrigger(value as AutomationEventKind);
                      }}
                      groups={[
                        {
                          options: props.events.map((event) => ({
                            value: event.kind,
                            label: t(`emailTemplates.events.${event.kind}`, {
                              defaultValue: event.label,
                            }),
                          })),
                        },
                      ]}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {node.config.eventKind
                      ? t(`automationBuilder.recipients.eventDescriptions.${node.config.eventKind}`)
                      : t("automationBuilder.recipients.selectTrigger")}
                  </p>
                </>
              )}
              {node.type === "condition" && (
                <ConditionSettings
                  node={node}
                  workflow={props.workflow}
                  branchPosition={props.branchPosition}
                  event={props.event}
                  disabled={readonly}
                  onChange={props.onSaveStep}
                />
              )}
              {node.type === "send_email" && (
                <EmailActionSettings
                  node={node}
                  workflow={props.workflow}
                  event={props.event}
                  templates={props.templates}
                  loadingTemplates={props.loadingTemplates}
                  readonly={readonly}
                  onChange={props.onSaveStep}
                  onValidityChange={props.onConfigurationValidityChange}
                />
              )}
            </div>
          </div>
          <Separator />
          <div className="px-4 py-3">
            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              disabled={readonly}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-2 size-4" aria-hidden="true" />
              {t("automationBuilder.editPanel.removeNode")}
            </Button>
          </div>
        </div>
      </aside>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("automationBuilder.canvas.deleteNodeDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t(
                node.type === "condition"
                  ? "automationBuilder.condition.deleteDescription"
                  : "automationBuilder.canvas.deleteNodeDialogDescription",
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t("common.button.cancel")}</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                setDeleteOpen(false);
                props.onRemove(node.id);
              }}
            >
              <Trash2 className="mr-2 size-4" aria-hidden="true" />
              {t("automations.deleteStep")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(pendingTrigger)}
        onOpenChange={(open) => {
          if (!open) setPendingTrigger(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("automationBuilder.editPanel.changeTriggerDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("automationBuilder.editPanel.changeTriggerDialogDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t("common.button.cancel")}</Button>
            </DialogClose>
            <Button
              variant="primary"
              onClick={() => {
                if (pendingTrigger) props.onChangeTrigger(pendingTrigger);
                setPendingTrigger(null);
              }}
            >
              {t("automationBuilder.editPanel.changeTriggerDialogConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
