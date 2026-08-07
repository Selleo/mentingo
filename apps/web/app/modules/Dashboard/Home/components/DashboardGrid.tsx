import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
  type Modifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  type SortingStrategy,
} from "@dnd-kit/sortable";
import { DASHBOARD_WIDGETS, type DashboardWidgetId, type DashboardWidgetWidth } from "@repo/shared";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

import { DASHBOARD_WIDGET_REGISTRY } from "../widgetRegistry";

import { DashboardEmpty } from "./DashboardEmpty";
import {
  getDashboardDropPlacement,
  projectDashboardDragPreview,
  type DropPlacement,
} from "./dashboardGrid.utils";
import { SortableWidget } from "./SortableWidget";

import type { DashboardLayoutItem } from "../types";

type DashboardGridProps = {
  widgets: DashboardLayoutItem[];
  isEditing: boolean;
  onWidgetsChange: (widgets: DashboardLayoutItem[]) => void;
};

type ActiveWidgetSize = {
  width: number;
  height: number;
};

const VIEWPORT_PADDING = 16;

const restrictOverlayToViewport: Modifier = ({ transform, draggingNodeRect, windowRect }) => {
  if (!draggingNodeRect || !windowRect) return transform;

  const minimumX = windowRect.left + VIEWPORT_PADDING - draggingNodeRect.left;
  const maximumX = windowRect.right - VIEWPORT_PADDING - draggingNodeRect.right;

  return {
    ...transform,
    x: Math.min(Math.max(transform.x, minimumX), maximumX),
  };
};

const OVERLAY_MODIFIERS = [restrictOverlayToViewport];

const gridReflowStrategy: SortingStrategy = () => null;

type DashboardDragState = {
  previewWidgets: DashboardLayoutItem[] | null;
  widgetsAtDragStart: DashboardLayoutItem[] | null;
  hasDragOrderChanged: boolean;
  lastOverId: DashboardWidgetId | null;
  lastDropPlacement: DropPlacement | null;
  appliedDropTarget: {
    id: DashboardWidgetId;
    placement: DropPlacement | null;
  } | null;
  initialDroppableRects: Parameters<CollisionDetection>[0]["droppableRects"] | null;
};

export function DashboardGrid({ widgets, isEditing, onWidgetsChange }: DashboardGridProps) {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<DashboardWidgetId | null>(null);
  const [activeWidgetSize, setActiveWidgetSize] = useState<ActiveWidgetSize | null>(null);
  const [previewWidgets, setPreviewWidgets] = useState<DashboardLayoutItem[] | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DashboardDragState>({
    previewWidgets: null,
    widgetsAtDragStart: null,
    hasDragOrderChanged: false,
    lastOverId: null,
    lastDropPlacement: null,
    appliedDropTarget: null,
    initialDroppableRects: null,
  });
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const sortedWidgets = [...widgets].sort((first, second) => first.order - second.order);
  const displayedWidgets = previewWidgets ?? sortedWidgets;
  const activeEntry = activeId ? DASHBOARD_WIDGET_REGISTRY[activeId] : null;
  const ActiveIcon = activeEntry?.icon;
  /**
   * Keeps pointer-based collision detection tied to the original grid geometry
   * so the dragged card does not make its own drop target move underneath it.
   */
  const dashboardCollisionDetection: CollisionDetection = (args) => {
    const inactiveDroppableContainers = args.droppableContainers.filter(
      (container) => container.id !== args.active.id,
    );

    if (args.pointerCoordinates) {
      const gridRect = gridRef.current?.getBoundingClientRect();
      const isPointerInsideGrid =
        gridRect &&
        args.pointerCoordinates.x >= gridRect.left &&
        args.pointerCoordinates.x <= gridRect.right &&
        args.pointerCoordinates.y >= gridRect.top &&
        args.pointerCoordinates.y <= gridRect.bottom;

      if (!isPointerInsideGrid) {
        dragStateRef.current.lastOverId = null;
        dragStateRef.current.lastDropPlacement = null;
        return [];
      }

      if (!dragStateRef.current.initialDroppableRects) {
        dragStateRef.current.initialDroppableRects = new Map(args.droppableRects);
      }

      const pointerCollisions = pointerWithin({
        ...args,
        droppableRects: dragStateRef.current.initialDroppableRects,
      });
      const [pointerCollision] = pointerCollisions;
      if (pointerCollision) {
        const pointerCollisionId = pointerCollision.id as DashboardWidgetId;
        const previousPlacement =
          dragStateRef.current.lastOverId === pointerCollisionId
            ? dragStateRef.current.lastDropPlacement
            : null;
        dragStateRef.current.lastOverId = pointerCollisionId;
        const targetRect = dragStateRef.current.initialDroppableRects.get(pointerCollision.id);
        const activeRect = args.active.rect.current.initial;
        dragStateRef.current.lastDropPlacement = getDashboardDropPlacement(
          args.pointerCoordinates.x,
          targetRect,
          activeRect,
          previousPlacement,
        );
        return pointerCollisions;
      }

      return dragStateRef.current.lastOverId ? [{ id: dragStateRef.current.lastOverId }] : [];
    }

    const keyboardCollisions = closestCenter({
      ...args,
      droppableContainers: inactiveDroppableContainers,
    });
    const [keyboardCollision] = keyboardCollisions;
    if (keyboardCollision) {
      dragStateRef.current.lastOverId = keyboardCollision.id as DashboardWidgetId;
      dragStateRef.current.lastDropPlacement = null;
    }

    return keyboardCollisions;
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(active.id as DashboardWidgetId);
    const initialPreview = sortedWidgets.map((widget) => ({ ...widget }));
    setPreviewWidgets(initialPreview);
    dragStateRef.current.previewWidgets = initialPreview;
    dragStateRef.current.widgetsAtDragStart = initialPreview;
    dragStateRef.current.hasDragOrderChanged = false;
    dragStateRef.current.lastOverId = null;
    dragStateRef.current.lastDropPlacement = null;
    dragStateRef.current.appliedDropTarget = null;
    dragStateRef.current.initialDroppableRects = null;

    const activeRect = active.rect.current.initial;
    setActiveWidgetSize(activeRect ? { width: activeRect.width, height: activeRect.height } : null);
  };

  const updateDragPreview = ({ active, over }: DragOverEvent | DragMoveEvent) => {
    if (!over) return;

    const overId = over.id as DashboardWidgetId;
    const dropPlacement = dragStateRef.current.lastDropPlacement;
    const previousAppliedTarget = dragStateRef.current.appliedDropTarget;
    if (previousAppliedTarget?.id === overId && previousAppliedTarget.placement === dropPlacement) {
      return;
    }
    dragStateRef.current.appliedDropTarget = { id: overId, placement: dropPlacement };

    if (active.id === overId) {
      const initialWidgets = dragStateRef.current.widgetsAtDragStart;
      if (!initialWidgets) return;

      setPreviewWidgets((currentWidgets) => {
        if (currentWidgets?.every((widget, index) => widget.id === initialWidgets[index]?.id)) {
          return currentWidgets;
        }

        dragStateRef.current.previewWidgets = initialWidgets;
        dragStateRef.current.hasDragOrderChanged = false;
        return initialWidgets;
      });
      return;
    }

    setPreviewWidgets((currentWidgets) => {
      const initialWidgets = dragStateRef.current.widgetsAtDragStart;
      if (!currentWidgets || !initialWidgets) return currentWidgets;

      const projectedPreview = projectDashboardDragPreview(
        initialWidgets,
        currentWidgets,
        active.id as DashboardWidgetId,
        overId,
        dropPlacement ?? undefined,
      );
      dragStateRef.current.previewWidgets = projectedPreview.widgets;
      dragStateRef.current.hasDragOrderChanged = projectedPreview.hasChanged;

      return projectedPreview.widgets;
    });
  };

  const handleDragMove = (event: DragMoveEvent) => {
    if (dragStateRef.current.lastDropPlacement) {
      updateDragPreview(event);
    }
  };

  const resetDragState = () => {
    setActiveId(null);
    setActiveWidgetSize(null);
    setPreviewWidgets(null);
    dragStateRef.current.previewWidgets = null;
    dragStateRef.current.widgetsAtDragStart = null;
    dragStateRef.current.hasDragOrderChanged = false;
    dragStateRef.current.lastOverId = null;
    dragStateRef.current.lastDropPlacement = null;
    dragStateRef.current.appliedDropTarget = null;
    dragStateRef.current.initialDroppableRects = null;
  };

  const handleDragEnd = ({ over }: DragEndEvent) => {
    if (over && dragStateRef.current.hasDragOrderChanged && dragStateRef.current.previewWidgets) {
      onWidgetsChange(dragStateRef.current.previewWidgets);
    }

    resetDragState();
  };

  const handleDragCancel = () => {
    resetDragState();
  };

  const handleWidthChange = (id: DashboardWidgetId) => {
    onWidgetsChange(
      widgets.map((widget) => {
        if (widget.id !== id) return widget;

        const allowedWidths: readonly DashboardWidgetWidth[] = DASHBOARD_WIDGETS[id].allowedWidths;
        const currentIndex = allowedWidths.indexOf(widget.width);
        const nextWidth = allowedWidths[(currentIndex + 1) % allowedWidths.length];

        return { ...widget, width: nextWidth ?? widget.width };
      }),
    );
  };

  return (
    <div className="min-w-0 overflow-x-clip">
      {sortedWidgets.length === 0 ? (
        <DashboardEmpty isEditing={isEditing} />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={dashboardCollisionDetection}
          measuring={{ droppable: { strategy: MeasuringStrategy.WhileDragging } }}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragOver={updateDragPreview}
          onDragCancel={handleDragCancel}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={displayedWidgets.map((widget) => widget.id)}
            strategy={gridReflowStrategy}
          >
            <div
              ref={gridRef}
              className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:gap-6"
            >
              {displayedWidgets.map((widget) => (
                <SortableWidget
                  key={widget.id}
                  widget={widget}
                  isEditing={isEditing}
                  onWidthChange={handleWidthChange}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay adjustScale={false} modifiers={OVERLAY_MODIFIERS}>
            {activeEntry && ActiveIcon && (
              <div
                className="pointer-events-none max-w-[calc(100vw-2rem)] rotate-1 overflow-hidden rounded-lg border-2 border-primary-300 bg-white opacity-95 shadow-xl"
                style={{
                  width: activeWidgetSize?.width,
                  height: activeWidgetSize?.height,
                }}
                aria-hidden="true"
              >
                <div className="flex h-full items-start gap-3 p-5">
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-lg",
                      activeEntry.iconContainerClassName,
                    )}
                  >
                    <ActiveIcon
                      className={cn("size-5", activeEntry.iconClassName)}
                      aria-hidden="true"
                    />
                  </span>
                  <span className="body-lg-md min-w-0 truncate pt-2 text-neutral-950">
                    {t(activeEntry.titleKey)}
                  </span>
                </div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
