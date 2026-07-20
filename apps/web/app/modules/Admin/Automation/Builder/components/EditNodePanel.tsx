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
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";

import { TRIGGER_DEFINITIONS, getStepDefinition } from "../automationBuilder.types";
import { useBuilderStore } from "../automationBuilderStore";
import { useCoursesOptions } from "../hooks/useCourses";
import { useCourseUsers } from "../hooks/useCourseUsers";

import { ConfigFieldRenderer } from "./CofigFieldRenderer";

import type { AutomationStepDefinition, TriggerType } from "../automationBuilder.types";
import type { FC } from "react";
import type { Option } from "~/components/ui/multiselect";

export const EditNodePanel: FC = () => {
  const { t } = useTranslation();
  const selectedNodeId = useBuilderStore((s) => s.selectedNodeId);
  const nodes = useBuilderStore((s) => s.nodes);
  const selectNode = useBuilderStore((s) => s.selectNode);
  const updateNodeConfig = useBuilderStore((s) => s.updateNodeConfig);
  const updateNodeType = useBuilderStore((s) => s.updateNodeType);
  const removeNode = useBuilderStore((s) => s.removeNode);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const stepDefinition = selectedNode ? getStepDefinition(selectedNode.type) : undefined;

  const { options: courseOptions } = useCoursesOptions();

  const selectedCourseId = selectedNode?.config?.courseId as string | undefined;

  const { options: userOptions } = useCourseUsers(selectedCourseId);
  const dynamicOptions: Record<string, Option[]> = {
    courses: courseOptions,
    users: userOptions,
  };

  const [changeTriggerDialogOpen, setChangeTriggerDialogOpen] = useState(false);
  const [pendingTriggerDef, setPendingTriggerDef] = useState<AutomationStepDefinition | null>(null);

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

                {stepDefinition.configFields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label>{t(field.labelKey)}</Label>
                    <ConfigFieldRenderer
                      field={field}
                      value={selectedNode.config[field.key]}
                      onChange={(value) =>
                        updateNodeConfig(selectedNode.id, { [field.key]: value })
                      }
                      t={t}
                      dynamicOptions={dynamicOptions}
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
