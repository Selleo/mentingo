import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

import { DASHBOARD_EDIT_HANDLES } from "../../../../../e2e/data/dashboard/handles";

import { DashboardWidgetSizePicker } from "./DashboardWidgetSizePicker";

import type { DashboardWidgetSize } from "../types";
import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
import type { DashboardWidgetType } from "@repo/shared";
import type { ReactNode } from "react";

type DashboardWidgetShellProps = {
  children: ReactNode;
  type: DashboardWidgetType;
  title: string;
  size?: DashboardWidgetSize;
  isEditing: boolean;
  isDragging: boolean;
  allowedSizes: DashboardWidgetSize[];
  dragAreaAttributes: DraggableAttributes;
  dragAreaListeners: DraggableSyntheticListeners;
  setDragAreaRef: (element: HTMLElement | null) => void;
  onSizeChange: (size: DashboardWidgetSize) => void;
};

export function DashboardWidgetShell({
  children,
  type,
  title,
  size,
  isEditing,
  isDragging,
  allowedSizes,
  dragAreaAttributes,
  dragAreaListeners,
  setDragAreaRef,
  onSizeChange,
}: DashboardWidgetShellProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn("relative h-full rounded-lg transition-[box-shadow,opacity]", {
        "border-2 border-primary-200": isEditing,
        "opacity-30": isDragging,
      })}
    >
      <div
        ref={setDragAreaRef}
        className={cn("h-full", {
          "cursor-grab touch-none active:cursor-grabbing": isEditing,
        })}
        {...(isEditing ? dragAreaAttributes : {})}
        {...(isEditing ? dragAreaListeners : {})}
        aria-label={isEditing ? t("dashboardHome.edit.drag", { title }) : undefined}
        data-testid={isEditing ? DASHBOARD_EDIT_HANDLES.dragHandle(type) : undefined}
      >
        {children}
      </div>

      {isEditing && allowedSizes.length > 1 && (
        <DashboardWidgetSizePicker
          title={title}
          triggerTestId={DASHBOARD_EDIT_HANDLES.sizeTrigger(type)}
          selectedSize={size}
          allowedSizes={allowedSizes}
          onSelect={onSizeChange}
        />
      )}
    </div>
  );
}
