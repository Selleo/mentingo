import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useParams } from "@remix-run/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

import { useBuilderStore } from "./automationBuilderStore";
import { BlocksSidebar } from "./components/BlocksSidebar";
import { BuilderCanvas } from "./components/BuilderCanvas";
import { BuilderHeader } from "./components/BuilderHeader";
import { EditNodePanel } from "./components/EditNodePanel";

import type {
  AutomationStepDefinition,
  BuilderNode,
  SidebarBlock,
} from "./automationBuilder.types";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";

export default function AutomationBuilderPage() {
  const { t } = useTranslation();
  const { id: automationId = "new" } = useParams<{ id: string }>();
  const [activeDragBlock, setActiveDragBlock] = useState<SidebarBlock | null>(null);

  const addNode = useBuilderStore((s) => s.addNode);
  const addChildNode = useBuilderStore((s) => s.addChildNode);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const createNodeFromDefinition = (
    definition: AutomationStepDefinition,
    parentId: string | null,
  ): BuilderNode => ({
    id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind: definition.kind,
    type: definition.type,
    label: t(definition.labelKey),
    parentId,
    children: [],
    position: { x: 0, y: 0 },
    config: {},
  });

  const createNodeFromBlock = (block: SidebarBlock, parentId: string | null): BuilderNode => ({
    id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind: block.kind,
    type: block.type,
    label: t(block.labelKey),
    parentId,
    children: [],
    position: { x: 0, y: 0 },
    config: {},
  });

  const handleDragStart = (event: DragStartEvent) => {
    const block = event.active.data.current?.block as SidebarBlock | undefined;
    setActiveDragBlock(block ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragBlock(null);
    const { active, over } = event;

    if (!over) return;

    const block = active.data.current?.block as SidebarBlock | undefined;
    if (!block) return;

    const targetNodeId = over.data.current?.targetNodeId as string | null | undefined;

    if (over.id === "canvas-root") {
      const newNode = createNodeFromBlock(block, null);
      addNode(newNode);
    } else if (targetNodeId) {
      const newNode = createNodeFromBlock(block, targetNodeId);
      addChildNode(targetNodeId, newNode);
    }
  };

  const handleAddChild = (parentId: string, definition: AutomationStepDefinition) => {
    const newNode = createNodeFromDefinition(definition, parentId);
    addChildNode(parentId, newNode);
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <BuilderHeader automationId={automationId} />

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="relative flex flex-1 overflow-hidden">
          <BlocksSidebar />

          <BuilderCanvas onAddChild={handleAddChild} />

          <EditNodePanel />
        </div>

        <DragOverlay>
          {activeDragBlock && (
            <div
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm shadow-lg",
                activeDragBlock.kind === "condition"
                  ? "border-blue-200 bg-blue-50"
                  : "border-emerald-200 bg-emerald-50",
              )}
            >
              <span className="font-medium">{t(activeDragBlock.labelKey)}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
