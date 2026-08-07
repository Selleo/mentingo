import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DASHBOARD_WIDGETS } from "@repo/shared";
import { motion, useReducedMotion } from "motion/react";
import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

import { DASHBOARD_WIDGET_REGISTRY } from "../widgetRegistry";

import { DashboardWidgetShell } from "./DashboardWidgetShell";

import type { DashboardLayoutItem } from "../types";
import type { DashboardWidgetId } from "@repo/shared";
import type { Transition } from "motion/react";

type SortableWidgetProps = {
  widget: DashboardLayoutItem;
  isEditing: boolean;
  onWidthChange: (id: DashboardWidgetId) => void;
};

const WIDGET_LAYOUT_TRANSITION: Transition = {
  duration: 0.24,
  ease: [0.22, 1, 0.36, 1],
};

export function SortableWidget({ widget, isEditing, onWidthChange }: SortableWidgetProps) {
  const { t } = useTranslation();
  const shouldReduceMotion = useReducedMotion();
  const registryEntry = DASHBOARD_WIDGET_REGISTRY[widget.id];
  const definition = DASHBOARD_WIDGETS[widget.id];
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

  return (
    <div
      ref={setNodeRef}
      data-dashboard-widget-hitbox="true"
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
      }}
      className={cn(
        "min-w-0",
        widget.width === 2 ? "md:col-span-2 xl:col-span-2" : "md:col-span-1 xl:col-span-1",
        { "z-10": isDragging },
      )}
    >
      <motion.div
        layout="position"
        data-dashboard-widget-visual="true"
        transition={shouldReduceMotion ? { duration: 0 } : WIDGET_LAYOUT_TRANSITION}
        className="h-full min-w-0"
      >
        <DashboardWidgetShell
          title={title}
          width={widget.width}
          isEditing={isEditing}
          isDragging={isDragging}
          canResize={definition.allowedWidths.length > 1}
          dragAreaAttributes={attributes}
          dragAreaListeners={listeners}
          setDragAreaRef={setActivatorNodeRef}
          onWidthChange={() => onWidthChange(widget.id)}
        >
          <WidgetComponent />
        </DashboardWidgetShell>
      </motion.div>
    </div>
  );
}
