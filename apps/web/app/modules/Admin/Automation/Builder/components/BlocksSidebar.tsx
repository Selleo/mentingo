import { useDraggable } from "@dnd-kit/core";
import { AlertTriangle, Award, CalendarClock, CircleX, Mail, UserPlus, Video } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

import { ACTION_BLOCKS, CONDITION_BLOCKS } from "../automationBuilder.types";

import type { SidebarBlock } from "../automationBuilder.types";
import type { FC, ReactNode } from "react";

const ICON_MAP: Record<string, ReactNode> = {
  "calendar-clock": <CalendarClock className="size-4" />,
  "alert-triangle": <AlertTriangle className="size-4" />,
  "circle-x": <CircleX className="size-4" />,
  "user-plus": <UserPlus className="size-4" />,
  award: <Award className="size-4" />,
  video: <Video className="size-4" />,
  mail: <Mail className="size-4" />,
};

interface DraggableBlockProps {
  block: SidebarBlock;
}

const DraggableBlock: FC<DraggableBlockProps> = ({ block }) => {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `sidebar-${block.kind}-${block.type}`,
    data: { block },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "flex cursor-grab items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm transition-shadow select-none",
        "hover:border-primary/40 hover:shadow-sm",
        block.kind === "condition"
          ? "border-blue-200 bg-blue-50/50"
          : "border-emerald-200 bg-emerald-50/50",
        isDragging && "opacity-50 shadow-md",
      )}
    >
      <span
        className={cn(
          "flex size-7 items-center justify-center rounded",
          block.kind === "condition"
            ? "bg-blue-100 text-blue-600"
            : "bg-emerald-100 text-emerald-600",
        )}
      >
        {ICON_MAP[block.icon]}
      </span>
      <span className="font-medium">{t(block.labelKey)}</span>
    </div>
  );
};

export const BlocksSidebar: FC = () => {
  const { t } = useTranslation();

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-background">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">
          {t("automationBuilder.sidebar.title")}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t("automationBuilder.sidebar.description")}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-4">
          <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("automationBuilder.sidebar.conditions")}
          </h3>
          <div className="space-y-2">
            {CONDITION_BLOCKS.map((block) => (
              <DraggableBlock key={block.type} block={block} />
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("automationBuilder.sidebar.actions")}
          </h3>
          <div className="space-y-2">
            {ACTION_BLOCKS.map((block) => (
              <DraggableBlock key={block.type} block={block} />
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};
