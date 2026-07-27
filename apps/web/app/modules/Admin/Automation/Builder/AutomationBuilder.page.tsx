import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useParams } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAutomationById } from "~/api/queries/admin/useAutomationById";
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

function generateNodeId(): string {
  return crypto.randomUUID();
}

function createNode(
  kind: BuilderNode["kind"],
  type: BuilderNode["type"],
  label: string,
  parentId: string | null,
): BuilderNode {
  return {
    id: generateNodeId(),
    kind,
    type,
    label,
    parentId,
    children: [],
    position: { x: 0, y: 0 },
    config: {},
  };
}

export default function AutomationBuilderPage() {
  const { t } = useTranslation();
  const { id: automationId = "new" } = useParams<{ id: string }>();
  const [activeDragBlock, setActiveDragBlock] = useState<SidebarBlock | null>(null);

  const addNode = useBuilderStore((s) => s.addNode);
  const addChildNode = useBuilderStore((s) => s.addChildNode);
  const loadNodes = useBuilderStore((s) => s.loadNodes);
  const reset = useBuilderStore((s) => s.reset);
  const setAutomationName = useBuilderStore((s) => s.setAutomationName);
  const setActive = useBuilderStore((s) => s.setActive);
  const setSimulationPassed = useBuilderStore((s) => s.setSimulationPassed);

  // Load automation data from API when editing existing automation
  const { data: automation } = useAutomationById(automationId);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    // Reset loaded flag when automation ID changes (navigating to a different automation)
    hasLoadedRef.current = false;
  }, [automationId]);

  useEffect(() => {
    if (automation && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      reset();
      setAutomationName(automation.name);

      // Load nodes into store without marking dirty
      const builderNodes: BuilderNode[] = automation.nodes.map((node) => ({
        id: node.id,
        kind: node.kind as BuilderNode["kind"],
        type: node.type as BuilderNode["type"],
        label: node.label,
        parentId: node.parentId,
        children: node.children,
        position: node.position,
        config: node.config,
      }));
      loadNodes(builderNodes);

      // Read simulationPassed from trigger node's config
      const triggerNode = automation.nodes.find((n) => n.kind === "trigger");
      const savedSimulationPassed = triggerNode?.config?.simulationPassed === true;

      // If any node has invalid simulation status, override both flags
      const hasInvalidNodes = builderNodes.some((n) => n.config?.simulationStatus === "invalid");

      if (hasInvalidNodes) {
        setSimulationPassed(false);
        setActive(false);
      } else {
        setSimulationPassed(savedSimulationPassed);
        setActive(automation.status === "enabled");
      }
    }
  }, [automation]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

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
    const nodes = useBuilderStore.getState().nodes;
    const hasTrigger = nodes.some((n) => n.kind === "trigger");

    if (over.id === "canvas-root") {
      if (block.kind !== "trigger" || hasTrigger) return;
      addNode(createNode(block.kind, block.type, t(block.labelKey), null));
    } else if (targetNodeId) {
      if (block.kind !== "action") return;
      addChildNode(
        targetNodeId,
        createNode(block.kind, block.type, t(block.labelKey), targetNodeId),
      );
    }
  };

  const handleAddChild = (parentId: string, definition: AutomationStepDefinition) => {
    if (definition.kind !== "action") return;
    addChildNode(
      parentId,
      createNode(definition.kind, definition.type, t(definition.labelKey), parentId),
    );
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
                activeDragBlock.kind === "trigger"
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
