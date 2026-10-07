import { useDroppable } from "@dnd-kit/core";
import { Workflow } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

import { useCanvasControls } from "../hooks/useCanvasControls";

import { CanvasNode } from "./CanvasNode";
import { CanvasZoomControls } from "./CanvasZoomControls";

import type { AutomationStep, AutomationWorkflow } from "@repo/shared";

interface BuilderCanvasProps {
  overlappingAutomationNames: string[];
  workflow: AutomationWorkflow;
  selectedId: string | null;
  readonly: boolean;
  labelFor: (step: AutomationStep) => string;
  onSelect: (id: string) => void;
  onSelectBranch: (id: string, position: number) => void;
  onAdd: (id: string, type: "send_email" | "condition", position?: number) => void;
  onRemove: (id: string) => void;
}

export function BuilderCanvas(props: BuilderCanvasProps) {
  const { t } = useTranslation();
  const controls = useCanvasControls();
  const { setNodeRef, isOver } = useDroppable({
    id: "canvas-root",
    data: { parentStepId: null },
    disabled: props.readonly,
  });
  const roots = props.workflow.steps
    .filter((step) => step.parentId === null)
    .sort((left, right) => left.position - right.position);

  return (
    <div
      className="relative flex min-h-0 min-w-0 flex-1 select-none flex-col overflow-hidden [&_*]:select-none"
      aria-label={t("automations.configuration")}
    >
      <div
        ref={(canvas) => {
          setNodeRef(canvas);
          controls.canvasRef.current = canvas;
        }}
        className={cn("relative min-h-0 flex-1 overflow-auto bg-neutral-100", {
          "cursor-grabbing": controls.isPanning,
          "bg-primary/5": isOver,
          "cursor-grab": !controls.isPanning,
        })}
        onPointerDown={controls.handlePointerDown}
        onPointerMove={controls.handlePointerMove}
        onPointerUp={controls.handlePointerUp}
        onPointerCancel={controls.handlePointerUp}
        data-canvas-bg="true"
      >
        {roots.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-muted-foreground">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted">
              <Workflow className="size-8" />
            </div>
            <div className="max-w-md text-center">
              <p className="text-sm font-medium">{t("automationBuilder.canvas.emptyTitle")}</p>
              <p className="mt-1 text-xs">{t("automationBuilder.creation.emptyDescription")}</p>
            </div>
          </div>
        ) : (
          <div
            className="inline-flex min-h-full min-w-full origin-center items-start justify-center p-12 transition-transform duration-100"
            style={{
              transform: `scale(${controls.zoom}) translate(${controls.pan.x / controls.zoom}px, ${controls.pan.y / controls.zoom}px)`,
            }}
            data-canvas-bg="true"
          >
            <div className="flex flex-col items-center gap-4 px-16">
              {roots.map((node) => (
                <CanvasNode key={node.id} {...props} node={node} />
              ))}
            </div>
          </div>
        )}
      </div>
      <CanvasZoomControls
        zoom={controls.zoom}
        onZoomIn={controls.handleZoomIn}
        onZoomOut={controls.handleZoomOut}
        onZoomReset={controls.handleZoomReset}
      />
    </div>
  );
}
