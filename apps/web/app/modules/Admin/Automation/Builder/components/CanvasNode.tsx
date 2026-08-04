import { useDroppable } from "@dnd-kit/core";
import { AlertCircle, Plus, Trash2 } from "lucide-react";
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
import { Card } from "~/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import { useBuilderStore } from "../automationBuilderStore";

import { AddNodePicker } from "./AddNodePicker";
import { BLOCK_ICON_MAP } from "./automationIcons";

import type { AutomationStepDefinition, BuilderNode } from "../automationBuilder.types";
import type { FC } from "react";

const VLine: FC<{ height: number }> = ({ height }) => (
  <div
    className="mx-auto shrink-0"
    style={{ width: 2, height, backgroundColor: "var(--connector-color)" }}
  />
);

const DownArrow: FC = () => (
  <div
    className="mx-auto shrink-0"
    style={{
      width: 0,
      height: 0,
      borderLeft: "5px solid transparent",
      borderRight: "5px solid transparent",
      borderTop: "6px solid var(--connector-color)",
    }}
  />
);

const RailSegment: FC<{ isFirst: boolean; isLast: boolean }> = ({ isFirst, isLast }) => (
  <div className="relative flex w-full justify-center" style={{ height: 2 }}>
    {!isFirst && (
      <div
        className="absolute left-0 top-0 h-0.5 w-1/2"
        style={{ backgroundColor: "var(--connector-color)" }}
      />
    )}
    {!isLast && (
      <div
        className="absolute right-0 top-0 h-0.5 w-1/2"
        style={{ backgroundColor: "var(--connector-color)" }}
      />
    )}
  </div>
);

interface CanvasNodeProps {
  node: BuilderNode;
  onAddChild: (parentId: string, definition: AutomationStepDefinition) => void;
}

export const CanvasNode: FC<CanvasNodeProps> = ({ node, onAddChild }) => {
  const { t } = useTranslation();
  const selectNode = useBuilderStore((s) => s.selectNode);
  const removeNode = useBuilderStore((s) => s.removeNode);
  const selectedNodeId = useBuilderStore((s) => s.selectedNodeId);
  const nodes = useBuilderStore((s) => s.nodes);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { setNodeRef, isOver } = useDroppable({
    id: `canvas-node-${node.id}`,
    data: { targetNodeId: node.id },
  });

  const isSelected = selectedNodeId === node.id;
  const childNodes = nodes.filter((n) => node.children.includes(n.id));

  return (
    <TooltipProvider>
      <div className="flex flex-col items-center [--connector-color:theme(colors.black)]">
        {/* Node card */}
        <Card
          ref={setNodeRef}
          className={cn(
            "group flex w-56 cursor-pointer items-center gap-2 border-2 px-3 py-2.5 transition-all",
            node.kind === "trigger"
              ? "border-blue-200 bg-blue-50 hover:bg-blue-100/60"
              : "border-emerald-200 bg-emerald-50 hover:bg-emerald-100/60",
            isSelected && "ring-2 ring-primary ring-offset-2",
            isOver && "ring-2 ring-amber-400 ring-offset-1",
          )}
          role="button"
          tabIndex={0}
          onClick={() => selectNode(node.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              selectNode(node.id);
            }
          }}
        >
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-md",
              node.kind === "trigger"
                ? "bg-blue-100 text-blue-600"
                : "bg-emerald-100 text-emerald-600",
            )}
          >
            {BLOCK_ICON_MAP[node.type]}
          </span>
          <span className="flex-1 truncate text-sm font-medium">{node.label}</span>
          {node.config.simulationStatus === "invalid" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex size-5 shrink-0 items-center justify-center">
                  <AlertCircle className="size-4 text-destructive" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                {t("automationBuilder.canvas.simulationFailed")}
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteDialogOpen(true);
                }}
                aria-label={t("automationBuilder.canvas.removeNode")}
              >
                <Trash2 className="size-3.5 text-error-500" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{t("automationBuilder.canvas.removeNode")}</TooltipContent>
          </Tooltip>
        </Card>

        {/* Connector: card → add button */}
        <VLine height={16} />

        {/* Add child picker */}
        <AddNodePicker
          onSelect={(definition) => onAddChild(node.id, definition)}
          trigger={
            <Button
              variant="outline"
              size="icon"
              className="size-7 rounded-full border-dashed"
              aria-label={t("automationBuilder.canvas.addChild")}
            >
              <Plus className="size-3.5" />
            </Button>
          }
        />

        {/* Children */}
        {childNodes.length > 0 && (
          <>
            <VLine height={20} />

            {childNodes.length === 1 ? (
              <div className="flex flex-col items-center">
                <DownArrow />
                <CanvasNode node={childNodes[0]} onAddChild={onAddChild} />
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="flex">
                  {childNodes.map((child, index) => (
                    <div key={child.id} className="flex flex-col items-center">
                      <RailSegment isFirst={index === 0} isLast={index === childNodes.length - 1} />
                      <div className="flex flex-col items-center px-5">
                        <VLine height={18} />
                        <DownArrow />
                        <CanvasNode node={child} onAddChild={onAddChild} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("automationBuilder.canvas.deleteNodeDialogTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("automationBuilder.canvas.deleteNodeDialogDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)}>
              {t("automationBuilder.canvas.deleteNodeDialogCancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                removeNode(node.id);
                setDeleteDialogOpen(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("automationBuilder.canvas.deleteNodeDialogConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
};
