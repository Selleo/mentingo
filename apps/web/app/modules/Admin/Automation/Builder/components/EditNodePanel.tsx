import { X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";

import { TRIGGER_DEFINITIONS, getStepDefinition } from "../automationBuilder.types";
import { useBuilderStore } from "../automationBuilderStore";

import type {
  AutomationStepDefinition,
  StepConfigField,
  TriggerType,
} from "../automationBuilder.types";
import type { FC } from "react";

const ConfigFieldRenderer: FC<{
  field: StepConfigField;
  value: unknown;
  onChange: (value: string) => void;
}> = ({ field, value, onChange }) => {
  const { t } = useTranslation();

  switch (field.type) {
    case "text":
    case "number":
      return (
        <Input
          type={field.type}
          placeholder={field.placeholderKey ? t(field.placeholderKey) : undefined}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "textarea":
      return (
        <Textarea
          rows={4}
          placeholder={field.placeholderKey ? t(field.placeholderKey) : undefined}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "select":
      return (
        <Select
          value={(value as string) ?? field.options?.[0]?.value ?? ""}
          onValueChange={onChange}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    default:
      return null;
  }
};

export const EditNodePanel: FC = () => {
  const { t } = useTranslation();
  const selectedNodeId = useBuilderStore((s) => s.selectedNodeId);
  const nodes = useBuilderStore((s) => s.nodes);
  const selectNode = useBuilderStore((s) => s.selectNode);
  const updateNodeConfig = useBuilderStore((s) => s.updateNodeConfig);
  const updateNodeType = useBuilderStore((s) => s.updateNodeType);
  const removeNode = useBuilderStore((s) => s.removeNode);

  const [changeTriggerDialogOpen, setChangeTriggerDialogOpen] = useState(false);
  const [pendingTriggerDef, setPendingTriggerDef] = useState<AutomationStepDefinition | null>(null);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const stepDefinition = selectedNode ? getStepDefinition(selectedNode.type) : undefined;

  const handleRequestChangeTrigger = (def: AutomationStepDefinition) => {
    setPendingTriggerDef(def);
    setChangeTriggerDialogOpen(true);
  };

  const handleConfirmChangeTrigger = () => {
    if (selectedNode && pendingTriggerDef) {
      updateNodeType(
        selectedNode.id,
        pendingTriggerDef.type as TriggerType,
        t(pendingTriggerDef.labelKey),
      );
    }
    setChangeTriggerDialogOpen(false);
    setPendingTriggerDef(null);
  };

  const handleCancelChangeTrigger = () => {
    setChangeTriggerDialogOpen(false);
    setPendingTriggerDef(null);
  };

  return (
    <>
      <aside
        className={cn(
          "absolute right-0 top-0 z-10 h-full w-80 transform border-l bg-background shadow-lg transition-transform duration-200",
          selectedNode ? "translate-x-0" : "translate-x-full",
        )}
      >
        {selectedNode && stepDefinition && (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="text-sm font-semibold">
                {selectedNode.kind === "trigger"
                  ? t("automationBuilder.editPanel.editTrigger")
                  : t("automationBuilder.editPanel.editAction")}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => selectNode(null)}
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("automationBuilder.editPanel.nodeType")}</Label>
                  <div
                    className={cn(
                      "rounded-md border px-3 py-2 text-sm",
                      selectedNode.kind === "trigger"
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700",
                    )}
                  >
                    {selectedNode.label}
                  </div>
                </div>

                {/* Change trigger select — only for trigger nodes */}
                {selectedNode.kind === "trigger" && (
                  <div className="space-y-2">
                    <Label>{t("automationBuilder.editPanel.changeTriggerLabel")}</Label>
                    <Select
                      value={selectedNode.type}
                      onValueChange={(value) => {
                        const def = TRIGGER_DEFINITIONS.find((d) => d.type === value);
                        if (def && def.type !== selectedNode.type) {
                          handleRequestChangeTrigger(def);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TRIGGER_DEFINITIONS.map((def) => (
                          <SelectItem key={def.type} value={def.type}>
                            {t(def.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <Separator />

                {/* Polymorphic config fields rendered from step definition */}
                {stepDefinition.configFields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label>{t(field.labelKey)}</Label>
                    <ConfigFieldRenderer
                      field={field}
                      value={selectedNode.config[field.key]}
                      onChange={(value) =>
                        updateNodeConfig(selectedNode.id, { [field.key]: value })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t px-4 py-3">
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={() => {
                  removeNode(selectedNode.id);
                }}
              >
                {t("automationBuilder.editPanel.removeNode")}
              </Button>
            </div>
          </div>
        )}
      </aside>

      {/* Confirmation dialog for changing trigger type */}
      <AlertDialog open={changeTriggerDialogOpen} onOpenChange={setChangeTriggerDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("automationBuilder.editPanel.changeTriggerDialogTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("automationBuilder.editPanel.changeTriggerDialogDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelChangeTrigger}>
              {t("automationBuilder.editPanel.changeTriggerDialogCancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmChangeTrigger}>
              {t("automationBuilder.editPanel.changeTriggerDialogConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
