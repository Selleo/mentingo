import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, useReducedMotion } from "motion/react";
import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

import { dashboardSizeToSpan } from "../types";
import { DASHBOARD_WIDGET_REGISTRY } from "../widgetRegistry";

import { DashboardWidgetShell } from "./DashboardWidgetShell";

import type { DashboardLayoutItem, DashboardWidgetSize } from "../types";
import type { DashboardWidgetType } from "@repo/shared";
import type { Transition } from "motion/react";

type SortableWidgetProps = {
  widget: DashboardLayoutItem;
  isEditing: boolean;
  onSizeChange: (id: DashboardWidgetType, size: DashboardWidgetSize) => void;
};

const WIDGET_LAYOUT_TRANSITION: Transition = {
  duration: 0.24,
  ease: [0.22, 1, 0.36, 1],
};

const WIDGET_COLUMN_CLASSES: Record<number, string> = {
  1: "col-span-1",
  2: "col-span-2",
  3: "col-span-2 md:col-span-3",
  4: "col-span-2 md:col-span-4",
};

export function SortableWidget({ widget, isEditing, onSizeChange }: SortableWidgetProps) {
  const { t } = useTranslation();
  const shouldReduceMotion = useReducedMotion();
  const registryEntry = DASHBOARD_WIDGET_REGISTRY[widget.id];
  const WidgetComponent = registryEntry.component;
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id, disabled: !isEditing });
  const title = t(registryEntry.titleKey);
  const span = dashboardSizeToSpan(widget.size);

  return (
    <div
      ref={setNodeRef}
      data-dashboard-widget-hitbox="true"
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        gridRow: `span ${span.rows} / span ${span.rows}`,
      }}
      className={cn("min-w-0", WIDGET_COLUMN_CLASSES[span.columns], isDragging && "z-10")}
    >
      <motion.div
        layout="position"
        data-dashboard-widget-visual="true"
        transition={shouldReduceMotion ? { duration: 0 } : WIDGET_LAYOUT_TRANSITION}
        className="h-full min-w-0"
      >
        <DashboardWidgetShell
          title={title}
          size={widget.size}
          isEditing={isEditing}
          isDragging={isDragging}
          allowedSizes={widget.allowedSizes ?? []}
          dragAreaAttributes={attributes}
          dragAreaListeners={listeners}
          setDragAreaRef={setActivatorNodeRef}
          onSizeChange={(size) => onSizeChange(widget.id, size)}
        >
          <WidgetComponent widgetSize={widget.size} />
        </DashboardWidgetShell>
      </motion.div>
    </div>
  );
}
