import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

import { DashboardWidgetSizePicker } from "./DashboardWidgetSizePicker";

import type { DashboardWidgetSize } from "../types";
import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
import type { ReactNode } from "react";

type DashboardWidgetShellProps = {
  children: ReactNode;
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
      >
        {children}
      </div>

      {isEditing && allowedSizes.length > 1 && (
        <DashboardWidgetSizePicker
          title={title}
          selectedSize={size}
          allowedSizes={allowedSizes}
          onSelect={onSizeChange}
        />
      )}
    </div>
  );
}
