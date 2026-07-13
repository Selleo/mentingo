import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

import { DASHBOARD_WIDGET_IDS } from "./dashboard.types";
import { reorderDashboardWidgets } from "./dashboard.utils";
import DeadlineRisksWidget from "./widgets/admin/DeadlineRisksWidget";
import EventCalendarWidget from "./widgets/admin/EventCalendarWidget";
import IncompleteCoursesWidget from "./widgets/admin/IncompleteCoursesWidget";
import TrainingCompletionWidget from "./widgets/admin/TrainingCompletionWidget";
import ContinueLearningWIdget from "./widgets/student/ContinueLearningWidget";

import type { DashboardWidgetLayout, DashboardWidgetId } from "./dashboard.types";
import type { ComponentType, CSSProperties, ReactNode } from "react";

type DashboardGridProps = {
  widgets: DashboardWidgetLayout[];
  isEditing: boolean;
  onReorder: (widgets: DashboardWidgetLayout[]) => void;
};

type SortableDashboardWidgetProps = {
  widget: DashboardWidgetLayout;
  isEditing: boolean;
  dragHandleLabel: string;
  children: ReactNode;
};

const WIDGET_COMPONENTS: Partial<Record<DashboardWidgetId, ComponentType>> = {
  [DASHBOARD_WIDGET_IDS.TRAINING_COMPLETION]: TrainingCompletionWidget,
  [DASHBOARD_WIDGET_IDS.CONTINUE_LEARNING]: ContinueLearningWIdget,
  [DASHBOARD_WIDGET_IDS.DEADLINE_RISKS]: DeadlineRisksWidget,
  [DASHBOARD_WIDGET_IDS.INCOMPLETE_COURSES]: IncompleteCoursesWidget,
  [DASHBOARD_WIDGET_IDS.EVENT_CALENDAR]: EventCalendarWidget,
};

function SortableDashboardWidget({
  widget,
  isEditing,
  dragHandleLabel,
  children,
}: SortableDashboardWidgetProps) {
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: widget.widgetId,
    disabled: !isEditing,
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative min-h-56 rounded-lg bg-white p-4 drop-shadow-card",
        isDragging && "z-10 opacity-60",
      )}
    >
      {isEditing ? (
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="absolute right-2 top-2 z-10 cursor-grab touch-none rounded-md bg-white p-1.5 text-neutral-600 shadow-sm hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
          aria-label={dragHandleLabel}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-5" />
        </button>
      ) : null}

      {children}
    </div>
  );
}

export default function DashboardGrid({ widgets, isEditing, onReorder }: DashboardGridProps) {
  const { t } = useTranslation();
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const orderedWidgets = [...widgets].sort((first, second) => first.order - second.order);
  const visibleWidgets = orderedWidgets.filter(
    (widget) => widget.enabled && WIDGET_COMPONENTS[widget.widgetId],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={({ active, over }) => {
        if (!over || active.id === over.id) {
          return;
        }

        onReorder(reorderDashboardWidgets(orderedWidgets, String(active.id), String(over.id)));
      }}
    >
      <SortableContext
        items={visibleWidgets.map(({ widgetId }) => widgetId)}
        strategy={rectSortingStrategy}
      >
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleWidgets.map((widget) => {
            const WidgetComponent = WIDGET_COMPONENTS[widget.widgetId];

            if (!WidgetComponent) {
              return null;
            }

            return (
              <SortableDashboardWidget
                key={widget.widgetId}
                widget={widget}
                isEditing={isEditing}
                dragHandleLabel={t("dashboardView.dragHandle")}
              >
                <WidgetComponent />
              </SortableDashboardWidget>
            );
          })}
        </section>
      </SortableContext>
    </DndContext>
  );
}
