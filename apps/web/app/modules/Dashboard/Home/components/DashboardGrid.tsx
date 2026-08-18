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
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { DASHBOARD_WIDGET_REGISTRY } from "../widgetRegistry";

import { DashboardEmpty } from "./DashboardEmpty";
import {
  getDashboardDropPlacement,
  projectDashboardDragPreview,
  type DropPlacement,
} from "./dashboardGrid.utils";
import { SortableWidget } from "./SortableWidget";
import { DashboardWidgetIcon } from "./WidgetCard";

import type { DashboardLayoutItem } from "../types";
import type { DashboardWidgetSize, DashboardWidgetType } from "@repo/shared";

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

/** Keeps the drag preview inside the visible viewport while preserving its Y position. */
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
  lastOverId: DashboardWidgetType | null;
  lastDropPlacement: DropPlacement | null;
  appliedDropTarget: {
    id: DashboardWidgetType;
    placement: DropPlacement | null;
  } | null;
  initialDroppableRects: Parameters<CollisionDetection>[0]["droppableRects"] | null;
};

type DashboardGridRefs = {
  grid: HTMLDivElement | null;
  dragState: DashboardDragState;
};

export function DashboardGrid({ widgets, isEditing, onWidgetsChange }: DashboardGridProps) {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<DashboardWidgetType | null>(null);
  const [activeWidgetSize, setActiveWidgetSize] = useState<ActiveWidgetSize | null>(null);
  const [previewWidgets, setPreviewWidgets] = useState<DashboardLayoutItem[] | null>(null);
  const dashboardRefs = useRef<DashboardGridRefs>({
    grid: null,
    dragState: {
      previewWidgets: null,
      widgetsAtDragStart: null,
      hasDragOrderChanged: false,
      lastOverId: null,
      lastDropPlacement: null,
      appliedDropTarget: null,
      initialDroppableRects: null,
    },
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
  /** Resolves pointer and keyboard collisions against the stable grid geometry. */
  const dashboardCollisionDetection: CollisionDetection = (args) => {
    const inactiveDroppableContainers = args.droppableContainers.filter(
      (container) => container.id !== args.active.id,
    );

    if (args.pointerCoordinates) {
      const gridRect = dashboardRefs.current.grid?.getBoundingClientRect();
      const isPointerInsideGrid =
        gridRect &&
        args.pointerCoordinates.x >= gridRect.left &&
        args.pointerCoordinates.x <= gridRect.right &&
        args.pointerCoordinates.y >= gridRect.top &&
        args.pointerCoordinates.y <= gridRect.bottom;

      if (!isPointerInsideGrid) {
        dashboardRefs.current.dragState.lastOverId = null;
        dashboardRefs.current.dragState.lastDropPlacement = null;
        return [];
      }

      if (!dashboardRefs.current.dragState.initialDroppableRects) {
        dashboardRefs.current.dragState.initialDroppableRects = new Map(args.droppableRects);
      }

      const pointerCollisions = pointerWithin({
        ...args,
        droppableRects: dashboardRefs.current.dragState.initialDroppableRects,
      });
      const [pointerCollision] = pointerCollisions;
      if (pointerCollision) {
        const pointerCollisionId = pointerCollision.id as DashboardWidgetType;
        const previousPlacement =
          dashboardRefs.current.dragState.lastOverId === pointerCollisionId
            ? dashboardRefs.current.dragState.lastDropPlacement
            : null;
        dashboardRefs.current.dragState.lastOverId = pointerCollisionId;
        const targetRect = dashboardRefs.current.dragState.initialDroppableRects.get(
          pointerCollision.id,
        );
        const activeRect = args.active.rect.current.initial;
        dashboardRefs.current.dragState.lastDropPlacement = getDashboardDropPlacement(
          args.pointerCoordinates.x,
          targetRect,
          activeRect,
          previousPlacement,
        );
        return pointerCollisions;
      }

      return dashboardRefs.current.dragState.lastOverId
        ? [{ id: dashboardRefs.current.dragState.lastOverId }]
        : [];
    }

    const keyboardCollisions = closestCenter({
      ...args,
      droppableContainers: inactiveDroppableContainers,
    });
    const [keyboardCollision] = keyboardCollisions;
    if (keyboardCollision) {
      dashboardRefs.current.dragState.lastOverId = keyboardCollision.id as DashboardWidgetType;
      dashboardRefs.current.dragState.lastDropPlacement = null;
    }

    return keyboardCollisions;
  };

  /** Captures the starting layout and geometry used by the drag preview. */
  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(active.id as DashboardWidgetType);
    const initialPreview = sortedWidgets.map((widget) => ({ ...widget }));
    setPreviewWidgets(initialPreview);
    dashboardRefs.current.dragState.previewWidgets = initialPreview;
    dashboardRefs.current.dragState.widgetsAtDragStart = initialPreview;
    dashboardRefs.current.dragState.hasDragOrderChanged = false;
    dashboardRefs.current.dragState.lastOverId = null;
    dashboardRefs.current.dragState.lastDropPlacement = null;
    dashboardRefs.current.dragState.appliedDropTarget = null;
    dashboardRefs.current.dragState.initialDroppableRects = null;

    const activeRect = active.rect.current.initial;
    setActiveWidgetSize(activeRect ? { width: activeRect.width, height: activeRect.height } : null);
  };

  /** Applies the projected order while dragging and reports whether it changed. */
  const updateDragPreview = ({ active, over }: DragOverEvent | DragMoveEvent) => {
    if (!over) return;

    const overId = over.id as DashboardWidgetType;
    const dropPlacement = dashboardRefs.current.dragState.lastDropPlacement;
    const previousAppliedTarget = dashboardRefs.current.dragState.appliedDropTarget;
    if (previousAppliedTarget?.id === overId && previousAppliedTarget.placement === dropPlacement) {
      return;
    }
    dashboardRefs.current.dragState.appliedDropTarget = { id: overId, placement: dropPlacement };

    if (active.id === overId) {
      const initialWidgets = dashboardRefs.current.dragState.widgetsAtDragStart;
      if (!initialWidgets) return;

      setPreviewWidgets((currentWidgets) => {
        if (currentWidgets?.every((widget, index) => widget.id === initialWidgets[index]?.id)) {
          return currentWidgets;
        }

        dashboardRefs.current.dragState.previewWidgets = initialWidgets;
        dashboardRefs.current.dragState.hasDragOrderChanged = false;
        return initialWidgets;
      });
      return;
    }

    setPreviewWidgets((currentWidgets) => {
      const initialWidgets = dashboardRefs.current.dragState.widgetsAtDragStart;
      if (!currentWidgets || !initialWidgets) return currentWidgets;

      const projectedPreview = projectDashboardDragPreview(
        initialWidgets,
        currentWidgets,
        active.id as DashboardWidgetType,
        overId,
        dropPlacement ?? undefined,
      );
      dashboardRefs.current.dragState.previewWidgets = projectedPreview.widgets;
      dashboardRefs.current.dragState.hasDragOrderChanged = projectedPreview.hasChanged;

      return projectedPreview.widgets;
    });
  };

  const handleDragMove = (event: DragMoveEvent) => {
    if (dashboardRefs.current.dragState.lastDropPlacement) {
      updateDragPreview(event);
    }
  };

  /** Clears transient drag state after completion or cancellation. */
  const resetDragState = () => {
    setActiveId(null);
    setActiveWidgetSize(null);
    setPreviewWidgets(null);
    dashboardRefs.current.dragState.previewWidgets = null;
    dashboardRefs.current.dragState.widgetsAtDragStart = null;
    dashboardRefs.current.dragState.hasDragOrderChanged = false;
    dashboardRefs.current.dragState.lastOverId = null;
    dashboardRefs.current.dragState.lastDropPlacement = null;
    dashboardRefs.current.dragState.appliedDropTarget = null;
    dashboardRefs.current.dragState.initialDroppableRects = null;
  };

  const handleDragEnd = ({ over }: DragEndEvent) => {
    if (
      over &&
      dashboardRefs.current.dragState.hasDragOrderChanged &&
      dashboardRefs.current.dragState.previewWidgets
    ) {
      onWidgetsChange(dashboardRefs.current.dragState.previewWidgets);
    }

    resetDragState();
  };

  const handleDragCancel = () => {
    resetDragState();
  };

  /** Applies an explicit semantic size selected from the server-provided catalog. */
  const handleSizeChange = (id: DashboardWidgetType, size: DashboardWidgetSize) => {
    onWidgetsChange(
      widgets.map((widget) =>
        widget.id === id && widget.allowedSizes?.includes(size) ? { ...widget, size } : widget,
      ),
    );
  };

  return (
    <div className="min-w-0 overflow-x-clip [container-type:inline-size]">
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
              ref={(element) => {
                dashboardRefs.current.grid = element;
              }}
              className="grid min-w-0 auto-rows-[calc((100cqw-1rem)/2)] grid-cols-2 gap-4 md:auto-rows-[calc((100cqw-3rem)/4)] md:grid-cols-4 xl:auto-rows-[calc((100cqw-7rem)/8)] xl:grid-cols-8 2xl:auto-rows-[calc((100cqw-10.5rem)/8)] 2xl:gap-6"
            >
              {displayedWidgets.map((widget) => (
                <SortableWidget
                  key={widget.id}
                  widget={widget}
                  isEditing={isEditing}
                  onSizeChange={handleSizeChange}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay adjustScale={false} modifiers={OVERLAY_MODIFIERS}>
            {activeEntry && ActiveIcon && (
              <div
                className="pointer-events-none max-w-[calc(100vw-2rem)] rotate-[0.4deg] overflow-hidden rounded-lg border border-primary-200 bg-white opacity-95 shadow-xl"
                style={{
                  width: activeWidgetSize?.width,
                  height: activeWidgetSize?.height,
                }}
                aria-hidden="true"
              >
                <div className="flex h-full flex-col">
                  <div className="flex min-h-14 items-center gap-2 border-b border-neutral-100 px-4 py-2.5">
                    <DashboardWidgetIcon icon={ActiveIcon} />
                    <span className="body-sm-md min-w-0 truncate text-neutral-950">
                      {t(activeEntry.titleKey)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
