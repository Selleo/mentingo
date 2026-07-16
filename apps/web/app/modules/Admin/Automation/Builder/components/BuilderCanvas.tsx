import { useDroppable } from "@dnd-kit/core";
import { Workflow } from "lucide-react";
import { type FC, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

import { useBuilderStore } from "../automationBuilderStore";

import { CanvasNode } from "./CanvasNode";
import { CanvasZoomControls } from "./CanvasZoomControls";

import type { AutomationStepDefinition } from "../automationBuilder.types";

interface BuilderCanvasProps {
  onAddChild: (parentId: string, definition: AutomationStepDefinition) => void;
}

const ZOOM_STEP = 0.15;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 2;

export const BuilderCanvas: FC<BuilderCanvasProps> = ({ onAddChild }) => {
  const { t } = useTranslation();
  const nodes = useBuilderStore((s) => s.nodes);
  const [zoom, setZoom] = useState(1);

  const rootNodes = nodes.filter((n) => n.parentId === null);

  const { setNodeRef, isOver } = useDroppable({
    id: "canvas-root",
    data: { targetNodeId: null },
  });

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(z + ZOOM_STEP, ZOOM_MAX));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(z - ZOOM_STEP, ZOOM_MIN));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoom(1);
  }, []);

  return (
    <div
      ref={setNodeRef}
      className={cn("relative flex-1 overflow-auto bg-muted/30", isOver && "bg-primary/5")}
    >
      <div
        className="flex min-h-full items-start justify-center p-8 transition-transform duration-150 origin-top"
        style={{ transform: `scale(${zoom})` }}
      >
        {rootNodes.length === 0 ? (
          <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-4 text-muted-foreground">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted">
              <Workflow className="size-8" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">{t("automationBuilder.canvas.emptyTitle")}</p>
              <p className="mt-1 text-xs">{t("automationBuilder.canvas.emptyDescription")}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            {rootNodes.map((node) => (
              <CanvasNode key={node.id} node={node} onAddChild={onAddChild} />
            ))}
          </div>
        )}
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
