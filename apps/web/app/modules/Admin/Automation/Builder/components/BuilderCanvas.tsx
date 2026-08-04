import { useDroppable } from "@dnd-kit/core";
import { Workflow } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

import { useBuilderStore } from "../automationBuilderStore";
import { useCanvasControls } from "../hooks/useCanvasControls";

import { CanvasNode } from "./CanvasNode";
import { CanvasZoomControls } from "./CanvasZoomControls";

import type { AutomationStepDefinition } from "../automationBuilder.types";
import type { FC, MutableRefObject } from "react";

interface BuilderCanvasProps {
  onAddChild: (parentId: string, definition: AutomationStepDefinition) => void;
}

export const BuilderCanvas: FC<BuilderCanvasProps> = ({ onAddChild }) => {
  const { t } = useTranslation();
  const nodes = useBuilderStore((s) => s.nodes);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const {
    zoom,
    pan,
    isPanning,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  } = useCanvasControls();

  const rootNodes = nodes.filter((n) => n.parentId === null);

  const { setNodeRef, isOver } = useDroppable({
    id: "canvas-root",
    data: { targetNodeId: null },
  });

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div
        ref={(node) => {
          setNodeRef(node);
          (scrollContainerRef as MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        className={cn(
          "flex-1 overflow-auto bg-muted/30",
          isOver && "bg-primary/5",
          isPanning && "cursor-grabbing",
          !isPanning && "cursor-grab",
        )}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        data-canvas-bg="true"
      >
        <div
          className="inline-flex min-h-full min-w-full items-start justify-center p-12 transition-transform duration-100 origin-center"
          style={{
            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
          }}
          data-canvas-bg="true"
        >
          {rootNodes.length === 0 ? (
            <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-4 text-muted-foreground">
              <div className="flex size-16 items-center justify-center rounded-full bg-muted">
                <Workflow className="size-8" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">{t("automationBuilder.canvas.emptyTitle")}</p>
                <p className="mt-1 text-xs">
                  {t("automationBuilder.canvas.emptyDescriptionTrigger")}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 px-16">
              {rootNodes.map((node) => (
                <CanvasNode key={node.id} node={node} onAddChild={onAddChild} />
              ))}
            </div>
          )}
        </div>
      </div>

      <CanvasZoomControls
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
      />
    </div>
  );
};
