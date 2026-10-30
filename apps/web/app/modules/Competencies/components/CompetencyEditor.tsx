import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

import { useCompetencyEditor } from "../hooks/useCompetencyEditor";

import { CompetenciesCategoryPicker } from "./CompetenciesCategoryPicker";
import { CompetencyCategoryEditor } from "./CompetencyCategoryEditor";
import { CompetencyDeleteConfirmation } from "./CompetencyDeleteConfirmation";
import { CompetencyLevelFields } from "./CompetencyLevelFields";
import { CompetencyLevelNavigation } from "./CompetencyLevelNavigation";

import type { CompetencyEditorOptions } from "../hooks/competencies-hooks.types";

export type CompetencyEditorProps = CompetencyEditorOptions;

export function CompetencyEditor({
  value,
  onSave,
  onClose,
  pending,
  onDelete,
}: CompetencyEditorProps) {
  const {
    deleteConfirmationOpen,
    categoryEditorOpen,
    setCategoryEditorOpen,
    selectCreatedCategory,
    createdCategory,
    setDeleteConfirmationOpen,
    deleteCompetency,
    saveCompetencyDraft,
    t,
    options,
    setSelectedLevelId,
    draft,
    setDraft,
    activeLevelId,
    updateLevel,
    updateCondition,
  } = useCompetencyEditor({ value, onSave, onClose, pending, onDelete });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-neutral-200 px-6 py-5 text-left">
          <DialogTitle>
            {t(value ? "competencies.editCompetency" : "competencies.newCompetency")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("competencies.descriptionByView.catalog")}
          </DialogDescription>
        </DialogHeader>
        <form className="flex min-h-0 flex-col" noValidate onSubmit={saveCompetencyDraft}>
          <div className="min-h-0 overflow-y-auto px-6 py-5">
            <fieldset disabled={pending} className="flex min-w-0 flex-col gap-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex min-w-0 flex-col gap-2">
                  <Label htmlFor="competency-name">{t("competencies.name")}</Label>
                  <Input
                    id="competency-name"
                    required
                    value={draft.name}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-2">
                  <CompetenciesCategoryPicker
                    label={t("competencies.category")}
                    value={draft.categoryId ?? ""}
                    emptyLabel={t("competencies.categories.none")}
                    selectedLabel={
                      createdCategory?.id === draft.categoryId ? createdCategory.name : undefined
                    }
                    createAction={{
                      label: t("competencies.categories.new"),
                      onSelect: () => setCategoryEditorOpen(true),
                    }}
                    onChange={(categoryId) =>
                      setDraft({ ...draft, categoryId: categoryId || null })
                    }
                  />
                </div>
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="competency-description">{t("competencies.description")}</Label>
                <Textarea
                  id="competency-description"
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                />
              </div>
              <div className="flex flex-col gap-3 border-t border-neutral-200 pt-5">
                <div className="space-y-0.5">
                  <h3 className="body-base-md text-neutral-950">{t("competencies.levels")}</h3>
                  <p className="details text-neutral-700">{t("competencies.editor.levelsHelp")}</p>
                </div>
                <div className="grid min-w-0 gap-4 md:grid-cols-[16rem_minmax(0,1fr)]">
                  <CompetencyLevelNavigation
                    setSelectedLevelId={setSelectedLevelId}
                    draft={draft}
                    setDraft={setDraft}
                    activeLevelId={activeLevelId}
                  />
                  <div className="min-w-0">
                    {draft.levels.length === 0 && (
                      <p className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-10 text-center text-sm text-neutral-800">
                        {t("competencies.editor.noLevels")}
                      </p>
                    )}
                    {draft.levels.map((level, index) => (
                      <CompetencyLevelFields
                        key={level.id}
                        options={options}
                        activeLevelId={activeLevelId}
                        updateLevel={updateLevel}
                        updateCondition={updateCondition}
                        pending={pending}
                        level={level}
                        index={index}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </fieldset>
          </div>
          <DialogFooter className="shrink-0 gap-2 border-t border-neutral-200 px-6 py-4 sm:gap-0">
            {onDelete && (
              <Button
                type="button"
                variant="outline"
                className="sm:mr-auto text-error-800"
                disabled={pending}
                onClick={() => setDeleteConfirmationOpen(true)}
              >
                {t("common.button.delete")}
              </Button>
            )}
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
              {t("competencies.cancel")}
            </Button>
            <Button type="submit" disabled={pending} aria-busy={pending}>
              {t(pending ? "competencies.saving" : "competencies.save")}
            </Button>
          </DialogFooter>
        </form>
        {categoryEditorOpen && (
          <CompetencyCategoryEditor
            onClose={() => setCategoryEditorOpen(false)}
            onSaved={selectCreatedCategory}
          />
        )}
        <CompetencyDeleteConfirmation
          open={deleteConfirmationOpen}
          onOpenChange={setDeleteConfirmationOpen}
          name={value?.name ?? ""}
          pending={pending}
          onDelete={deleteCompetency}
        />
      </DialogContent>
    </Dialog>
  );
}

export { CompetencyConditionRow } from "./CompetencyConditionRow";
