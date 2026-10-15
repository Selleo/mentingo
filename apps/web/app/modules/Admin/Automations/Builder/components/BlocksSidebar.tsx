import { useDraggable } from "@dnd-kit/core";
import { AUTOMATION_STEP_TYPES } from "@repo/shared";
import { GitBranch } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";

import { AutomationNodeIcon } from "./automationIcons";

import type { BuilderBlock } from "../builder.types";
import type { AutomationEventDefinition } from "@repo/shared";

interface DraggableBlockProps {
  block: BuilderBlock;
  disabled: boolean;
  onSelect: (block: BuilderBlock) => void;
}

function DraggableBlock({ block, disabled, onSelect }: DraggableBlockProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `sidebar-${block.eventKind ?? block.type}`,
    data: { block },
    disabled,
  });
  const isCondition = block.type === AUTOMATION_STEP_TYPES.CONDITION;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(block)}
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(block);
        }
      }}
      className={cn(
        "flex w-full cursor-pointer select-none text-left items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm border-neutral-200 bg-white transition-colors hover:border-neutral-300 hover:bg-neutral-50",
        {
          "opacity-50 shadow-md": isDragging,
          "cursor-default opacity-50": disabled,
        },
      )}
    >
      <span
        className={cn("flex size-7 shrink-0 items-center justify-center rounded", {
          "bg-primary-50 text-primary-600": !isCondition,
          "bg-neutral-100 text-neutral-600": isCondition,
        })}
      >
        {isCondition ? (
          <GitBranch className="size-4" />
        ) : (
          <AutomationNodeIcon eventKind={block.eventKind} />
        )}
      </span>
      <span className="font-medium">{block.label}</span>
    </button>
  );
}

interface BlocksSidebarProps {
  hasTrigger: boolean;
  events: AutomationEventDefinition[];
  disabled: boolean;
  loading: boolean;
  guidance: string;
  onSelectBlock: (block: BuilderBlock) => void;
}

export function BlocksSidebar({
  hasTrigger,
  events,
  disabled,
  loading,
  guidance,
  onSelectBlock,
}: BlocksSidebarProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const filteredEvents = events.filter((event) =>
    t(`emailTemplates.events.${event.kind}`, { defaultValue: event.label })
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase()),
  );

  return (
    <aside className="flex max-h-48 w-full shrink-0 flex-col border-b bg-white sm:h-full sm:max-h-none sm:w-64 sm:border-b-0 sm:border-r xl:w-80">
      <div className="flex shrink-0 items-center px-4 py-3">
        <h2 className="flex h-7 items-center text-sm font-semibold text-foreground">
          {t("automationBuilder.sidebar.title")}
        </h2>
      </div>
      <Separator />
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <p className="text-xs leading-relaxed text-muted-foreground">{guidance}</p>
        <Separator className="-mx-4 w-[calc(100%+2rem)]" />
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">
            {t(
              hasTrigger
                ? "automationBuilder.sidebar.actions"
                : "automationBuilder.sidebar.triggers",
            )}
          </h3>
          {!hasTrigger && (
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("automationBuilder.creation.searchTriggers")}
              aria-label={t("automationBuilder.creation.searchTriggers")}
            />
          )}
          <div className="space-y-2">
            {hasTrigger ? (
              <>
                <DraggableBlock
                  onSelect={onSelectBlock}
                  disabled={disabled}
                  block={{
                    type: AUTOMATION_STEP_TYPES.SEND_EMAIL,
                    label: t("automations.sendEmail"),
                  }}
                />
              </>
            ) : (
              filteredEvents.map((event) => (
                <DraggableBlock
                  key={event.kind}
                  onSelect={onSelectBlock}
                  disabled={disabled}
                  block={{
                    type: AUTOMATION_STEP_TYPES.TRIGGER,
                    eventKind: event.kind,
                    label: t(`emailTemplates.events.${event.kind}`, { defaultValue: event.label }),
                  }}
                />
              ))
            )}
            {!loading && !hasTrigger && filteredEvents.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t("automationBuilder.creation.noTriggers")}
              </p>
            )}
            {loading && (
              <p role="status" className="text-xs text-muted-foreground">
                {t("automations.loading")}
              </p>
            )}
          </div>
        </div>
        {hasTrigger && (
          <>
            <Separator className="-mx-4 w-[calc(100%+2rem)]" />
            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">{t("automationBuilder.sidebar.logic")}</h3>
              <DraggableBlock
                onSelect={onSelectBlock}
                disabled={disabled}
                block={{
                  type: AUTOMATION_STEP_TYPES.CONDITION,
                  label: t("automationBuilder.condition.title"),
                }}
              />
            </section>
          </>
        )}
      </div>
    </aside>
  );
}
