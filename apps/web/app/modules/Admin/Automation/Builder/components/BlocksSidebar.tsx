import { useDraggable } from "@dnd-kit/core";
import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

import { ACTION_BLOCKS, TRIGGER_BLOCKS } from "../automationBuilder.types";
import { useBuilderStore } from "../automationBuilderStore";

import { BLOCK_ICON_MAP } from "./automationIcons";

import type { SidebarBlock } from "../automationBuilder.types";
import type { FC } from "react";

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
        block.kind === "trigger"
          ? "border-blue-200 bg-blue-50/50"
          : "border-emerald-200 bg-emerald-50/50",
        isDragging && "opacity-50 shadow-md",
      )}
    >
      <span
        className={cn(
          "flex size-7 items-center justify-center rounded shrink-0",
          block.kind === "trigger"
            ? "bg-blue-100 text-blue-600"
            : "bg-emerald-100 text-emerald-600",
        )}
      >
        {BLOCK_ICON_MAP[block.icon]}
      </span>
      <span className="font-medium">{t(block.labelKey)}</span>
    </div>
  );
};

export const BlocksSidebar: FC = () => {
  const { t } = useTranslation();
  const nodes = useBuilderStore((s) => s.nodes);

  const hasTrigger = nodes.some((n) => n.kind === "trigger");

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-background">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">
          {t("automationBuilder.sidebar.title")}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {hasTrigger
            ? t("automationBuilder.sidebar.descriptionActions")
            : t("automationBuilder.sidebar.descriptionTrigger")}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        {!hasTrigger ? (
          <div>
            <div className="mb-3 flex items-start gap-2 rounded-md border border-blue-100 bg-blue-50/30 px-3 py-2">
              <Info className="mt-0.5 size-4 shrink-0 text-blue-500" />
              <p className="text-xs text-blue-700">
                {t("automationBuilder.sidebar.triggerInstruction")}
              </p>
            </div>
            <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("automationBuilder.sidebar.triggers")}
            </h3>
            <div className="space-y-2">
              {TRIGGER_BLOCKS.map((block) => (
                <DraggableBlock key={block.type} block={block} />
              ))}
            </div>
          </div>
        ) : (
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
        )}
      </div>
    </aside>
  );
};
