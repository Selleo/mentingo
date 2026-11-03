import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { SortableList } from "~/components/SortableList";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

import type { CompetencyEditorModel } from "../hooks/competencies-hook-models.types";

type CompetencyLevelNavigationProps = Pick<
  CompetencyEditorModel,
  "setSelectedLevelId" | "draft" | "setDraft" | "activeLevelId"
>;

export function CompetencyLevelNavigation({
  setSelectedLevelId,
  draft,
  setDraft,
  activeLevelId,
}: CompetencyLevelNavigationProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <SortableList
        items={draft.levels.map((level) => ({ ...level, sortableId: level.id }))}
        className="flex flex-col gap-1"
        portalOverlay
        onChange={(items) =>
          setDraft((current) => ({
            ...current,
            levels: items.map(
              (item) => current.levels.find((level) => level.id === item.sortableId)!,
            ),
          }))
        }
        renderItem={(level, index) => (
          <SortableList.Item
            id={level.sortableId}
            className={cn(
              "flex min-w-48 list-none items-center gap-1 rounded-lg border bg-white pl-1 pr-1 transition-colors",
              activeLevelId === level.id && "border-primary-300 bg-primary-50",
              activeLevelId !== level.id && "border-transparent hover:bg-neutral-50",
            )}
          >
            <SortableList.DragHandle
              aria-label={`${t("competencies.editor.reorder")}: ${level.name || index + 1}`}
              className="flex size-7 shrink-0 cursor-grab items-center justify-center rounded-md text-neutral-600 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 active:cursor-grabbing"
            >
              <GripVertical className="size-4" aria-hidden="true" />
            </SortableList.DragHandle>
            <button
              type="button"
              aria-current={activeLevelId === level.id ? "step" : undefined}
              onClick={() => setSelectedLevelId(level.id)}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2 rounded-lg py-2 pr-1 text-left text-sm",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600",
                activeLevelId === level.id && "text-primary-800",
                activeLevelId !== level.id && "text-neutral-900",
              )}
            >
              <span className="details-md flex size-6 shrink-0 items-center justify-center rounded-full bg-white text-primary-800 ring-1 ring-primary-200">
                {index + 1}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">
                  {level.name || t("competencies.editor.untitledLevel")}
                </span>
                <span className="details text-neutral-700">
                  {t("competencies.editor.conditionCount", {
                    count: level.conditions.length,
                  })}
                </span>
              </span>
            </button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-neutral-700 hover:text-error-700"
              aria-label={`${t("competencies.remove")}: ${level.name || index + 1}`}
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  levels: current.levels.filter((item) => item.id !== level.id),
                }))
              }
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </Button>
          </SortableList.Item>
        )}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => {
          const id = crypto.randomUUID();
          setDraft({
            ...draft,
            levels: [...draft.levels, { id, name: "", conditions: [] }],
          });
          setSelectedLevelId(id);
        }}
      >
        <Plus className="mr-2 size-4" aria-hidden="true" />
        {t("competencies.addLevel")}
      </Button>
    </div>
  );
}
