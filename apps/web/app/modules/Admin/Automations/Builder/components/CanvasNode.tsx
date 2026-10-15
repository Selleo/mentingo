import { useDroppable } from "@dnd-kit/core";
import { AUTOMATION_STEP_TYPES } from "@repo/shared";
import { ChevronDown, GitBranch, Layers, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";

import { AddNodePicker } from "./AddNodePicker";
import { AutomationNodeIcon } from "./automationIcons";

import type { AutomationStep, AutomationWorkflow } from "@repo/shared";

interface CanvasNodeProps {
  overlappingAutomationNames: string[];
  node: AutomationStep;
  workflow: AutomationWorkflow;
  selectedId: string | null;
  readonly: boolean;
  labelFor: (node: AutomationStep) => string;
  onSelect: (id: string) => void;
  onSelectBranch: (id: string, position: number) => void;
  onAdd: (id: string, type: "send_email" | "condition", position?: number) => void;
  onRemove: (id: string) => void;
}

function VLine({ height }: { height: number }) {
  return (
    <div
      className="mx-auto shrink-0"
      style={{ width: 1.5, height, backgroundColor: "var(--connector-color)" }}
    />
  );
}

function DownArrow() {
  return (
    <svg
      width="12"
      height="8"
      viewBox="0 0 12 8"
      fill="none"
      aria-hidden="true"
      className="-mt-px shrink-0 text-neutral-400"
    >
      <path
        d="M6 0v6M2 2l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RailSegment({ isFirst, isLast }: { isFirst: boolean; isLast: boolean }) {
  return (
    <div className="relative h-4 w-full">
      {!isFirst && (
        <div className="absolute left-0 top-0 h-4 w-1/2 rounded-tr-lg border-r-[1.5px] border-t-[1.5px] border-neutral-400" />
      )}
      {!isLast && (
        <div className="absolute right-0 top-0 h-4 w-1/2 rounded-tl-lg border-l-[1.5px] border-t-[1.5px] border-neutral-400" />
      )}
    </div>
  );
}

export function CanvasNode(props: CanvasNodeProps) {
  const { node, workflow, selectedId, readonly, labelFor, onSelect, onAdd, onRemove } = props;
  const { t } = useTranslation();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const children = workflow.steps
    .filter((step) => step.parentId === node.id)
    .sort((left, right) => left.position - right.position);
  const isCondition = node.type === AUTOMATION_STEP_TYPES.CONDITION;
  const isTrigger = node.type === AUTOMATION_STEP_TYPES.TRIGGER;
  const { setNodeRef, isOver } = useDroppable({
    id: `canvas-node-${node.id}`,
    data: { parentStepId: node.id },
    disabled: readonly || isCondition,
  });

  return (
    <>
      <div className="flex select-none flex-col items-center [--connector-color:theme(colors.neutral.400)]">
        <div className="relative">
          <Card
            ref={setNodeRef}
            className={cn(
              "group flex w-80 cursor-pointer items-center gap-2 border border-neutral-200 bg-white shadow-sm hover:border-neutral-300 px-3 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-inset",
              {
                "ring-1 ring-primary/40 ring-inset": selectedId === node.id,
                "ring-2 ring-primary/40 ring-inset": isOver,
              },
            )}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(node.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(node.id);
              }
            }}
          >
            <span
              className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", {
                "bg-primary-50 text-primary-600": !isCondition,
                "bg-neutral-100 text-neutral-600": isCondition,
              })}
            >
              {isCondition ? (
                <GitBranch className="size-4" />
              ) : (
                <AutomationNodeIcon
                  eventKind={
                    node.type === AUTOMATION_STEP_TYPES.TRIGGER ? node.config.eventKind : undefined
                  }
                />
              )}
            </span>
            <span className="min-w-0 flex-1 break-words text-sm font-medium">{labelFor(node)}</span>
            <Button
              variant="ghost"
              size="icon"
              disabled={readonly}
              className="size-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
              aria-label={t("automationBuilder.canvas.removeNode")}
              onClick={(event) => {
                event.stopPropagation();
                setDeleteOpen(true);
              }}
            >
              <Trash2 className="size-3.5 text-error-500" />
            </Button>
          </Card>
          {isTrigger && props.overlappingAutomationNames.length > 0 && (
            <details className="group absolute left-full top-2.5 ml-3 w-max select-none rounded-2xl border border-neutral-200 bg-white text-xs text-neutral-600 shadow-sm">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 whitespace-nowrap rounded-2xl px-2.5 py-1.5 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                <Layers className="size-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
                {t("automations.alsoUsedBy", {
                  count: props.overlappingAutomationNames.length,
                })}
                <ChevronDown
                  className="size-3.5 text-neutral-400 transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <ul className="w-0 min-w-full space-y-2 border-t border-neutral-100 px-3 py-2.5">
                {props.overlappingAutomationNames.map((name, index) => (
                  <li key={`${index}-${name}`} className="break-words">
                    {name}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
        {isCondition ? (
          <>
            <VLine height={24} />
            <div className="flex items-start">
              {[0, 1].map((position) => {
                const child = children.find((step) => step.position === position);
                return (
                  <div key={position} className="flex min-w-96 flex-col items-center">
                    <RailSegment isFirst={position === 0} isLast={position === 1} />
                    <button
                      type="button"
                      onClick={() => props.onSelectBranch(node.id, position)}
                      className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-600 hover:border-primary focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {t(
                        position === 0
                          ? "automationBuilder.condition.yes"
                          : "automationBuilder.condition.no",
                      )}
                    </button>
                    <VLine height={12} />
                    <BranchAddButton
                      parentId={node.id}
                      position={position}
                      readonly={readonly}
                      onAdd={onAdd}
                    />
                    {child ? (
                      <>
                        <VLine height={20} />
                        <DownArrow />
                        <CanvasNode {...props} node={child} />
                      </>
                    ) : (
                      <p className="mt-3 text-xs text-neutral-400">
                        {t("automationBuilder.condition.end")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <VLine height={16} />
            <BranchAddButton parentId={node.id} position={0} readonly={readonly} onAdd={onAdd} />
            {children[0] && (
              <>
                <VLine height={20} />
                <DownArrow />
                <CanvasNode {...props} node={children[0]} />
              </>
            )}
          </>
        )}
      </div>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("automationBuilder.canvas.deleteNodeDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t(
                isCondition
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
                onRemove(node.id);
              }}
            >
              {t("automations.deleteStep")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function BranchAddButton({
  parentId,
  position,
  readonly,
  onAdd,
}: {
  parentId: string;
  position: number;
  readonly: boolean;
  onAdd: CanvasNodeProps["onAdd"];
}) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({
    id: `branch-${parentId}-${position}`,
    data: { parentStepId: parentId, position },
    disabled: readonly,
  });
  return (
    <div ref={setNodeRef} className={cn("rounded-full", { "ring-2 ring-primary/40": isOver })}>
      <AddNodePicker
        onSelect={(type) => onAdd(parentId, type, position)}
        trigger={
          <Button
            variant="outline"
            size="icon"
            disabled={readonly}
            className="size-7 rounded-full border-neutral-300 bg-white text-neutral-500 hover:border-primary/40 hover:text-primary"
            aria-label={t("automationBuilder.canvas.addChild")}
          >
            <Plus className="size-3.5" />
          </Button>
        }
      />
    </div>
  );
}
