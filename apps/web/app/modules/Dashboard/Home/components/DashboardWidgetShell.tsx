import { Maximize2, Minimize2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
import type { DashboardWidgetWidth } from "@repo/shared";
import type { ReactNode } from "react";

type DashboardWidgetShellProps = {
  children: ReactNode;
  title: string;
  width: DashboardWidgetWidth;
  isEditing: boolean;
  isDragging: boolean;
  canResize: boolean;
  dragAreaAttributes: DraggableAttributes;
  dragAreaListeners: DraggableSyntheticListeners;
  setDragAreaRef: (element: HTMLElement | null) => void;
  onWidthChange: () => void;
};

export function DashboardWidgetShell({
  children,
  title,
  width,
  isEditing,
  isDragging,
  canResize,
  dragAreaAttributes,
  dragAreaListeners,
  setDragAreaRef,
  onWidthChange,
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

      {isEditing && canResize && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="absolute right-3 top-3 z-20 size-9 bg-white text-neutral-600 shadow-sm hover:text-neutral-950"
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          onClick={onWidthChange}
          aria-label={t("dashboardHome.edit.changeWidth", { title })}
          title={t("dashboardHome.edit.changeWidth", { title })}
        >
          {width === 1 ? (
            <Maximize2
              className="size-4"
              aria-label={isEditing ? t("dashboardHome.edit.changeWidth", { title }) : undefined}
            />
          ) : (
            <Minimize2
              className="size-4"
              aria-label={isEditing ? t("dashboardHome.edit.changeWidth", { title }) : undefined}
            />
          )}
        </Button>
      )}
    </div>
  );
}
