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
import { useEmailTemplatesForAutomation } from "../hooks/useEmailTemplatesForAutomation";

import { EditActionModal } from "./EditActionModal";

import type {
  AutomationStepDefinition,
  BuilderNode,
  TriggerType,
} from "../automationBuilder.types";
import type { FC } from "react";

export const EditNodePanel: FC = () => {
  const { t } = useTranslation();
  const selectedNodeId = useBuilderStore((s) => s.selectedNodeId);
  const nodes = useBuilderStore((s) => s.nodes);
  const selectNode = useBuilderStore((s) => s.selectNode);
  const updateNodeType = useBuilderStore((s) => s.updateNodeType);
  const removeNode = useBuilderStore((s) => s.removeNode);

  const [editActionNode, setEditActionNode] = useState<BuilderNode | null>(null);

  // Fetch custom email templates - always called (stable hook count)
  const { templates: customTemplates, isLoading: isLoadingCustomTemplates } =
    useEmailTemplatesForAutomation();

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const stepDefinition = selectedNode ? getStepDefinition(selectedNode.type) : undefined;

  const [deleteNodeDialogOpen, setDeleteNodeDialogOpen] = useState(false);
  const [changeTriggerDialogOpen, setChangeTriggerDialogOpen] = useState(false);
  const [pendingTriggerDef, setPendingTriggerDef] = useState<AutomationStepDefinition | null>(null);

  const handleRequestChangeTrigger = (def: AutomationStepDefinition) => {
    setPendingTriggerDef(def);
    setChangeTriggerDialogOpen(true);
  };

  const handleConfirmChangeTrigger = () => {
    if (selectedNode && pendingTriggerDef) {
      const nonTriggerNodes = nodes.filter((n) => n.id !== selectedNode.id);
      for (const node of nonTriggerNodes) {
        removeNode(node.id);
      }

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

                {selectedNode.kind === "action" && (
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => {
                      setEditActionNode(selectedNode);
                    }}
                  >
                    {t("automationBuilder.editPanel.editAction")}
                  </Button>
                )}
              </div>
            </div>

            <div className="border-t px-4 py-3">
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={() => {
                  setDeleteNodeDialogOpen(true);
                }}
              >
                {t("automationBuilder.editPanel.removeNode")}
              </Button>
            </div>
          </div>
        )}
      </aside>

      <AlertDialog open={deleteNodeDialogOpen} onOpenChange={setDeleteNodeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("automationBuilder.editPanel.deleteNodeDialogTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("automationBuilder.editPanel.deleteNodeDialogDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteNodeDialogOpen(false)}>
              {t("automationBuilder.editPanel.deleteNodeDialogCancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedNode) {
                  removeNode(selectedNode.id);
                }
                setDeleteNodeDialogOpen(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("automationBuilder.editPanel.deleteNodeDialogConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            <AlertDialogAction
              onClick={handleConfirmChangeTrigger}
              className="bg-destructive text-primary-foreground hover:bg-destructive/90"
            >
              {t("automationBuilder.editPanel.changeTriggerDialogConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editActionNode && (
        <EditActionModal
          key={editActionNode.id}
          open={Boolean(editActionNode)}
          onClose={() => setEditActionNode(null)}
          node={editActionNode}
          customTemplates={customTemplates}
          isLoadingCustomTemplates={isLoadingCustomTemplates}
        />
      )}
    </>
  );
};
