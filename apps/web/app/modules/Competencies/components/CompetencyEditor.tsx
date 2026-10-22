import { ArrowLeft, ArrowRight, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Textarea } from "~/components/ui/textarea";
import { UserMultiSelect } from "~/modules/Admin/Users/components/UserMultiSelect";

import { CompetenciesSelect } from "./CompetenciesSelect";

import type {
  Competency,
  CompetencyCondition,
  CompetencyLevel,
  CompetenciesWorkspace,
} from "../competencies.types";

type DefinitionInput = Pick<Competency, "name" | "description" | "category" | "levels">;
export function CompetencyEditor({
  value,
  workspace,
  onSave,
  onClose,
  pending,
  onArchive,
}: {
  value?: DefinitionInput;
  workspace: CompetenciesWorkspace;
  onSave: (value: DefinitionInput) => Promise<unknown>;
  onClose: () => void;
  pending: boolean;
  onArchive?: () => Promise<unknown>;
}) {
  const { t } = useTranslation();

  const [selectedLevelId, setSelectedLevelId] = useState(value?.levels[0]?.id ?? "");
  const [draft, setDraft] = useState<DefinitionInput>(
    value
      ? {
          name: value.name,
          description: value.description,
          category: value.category,
          levels: value.levels.map((level) => ({
            ...level,
            conditions: level.conditions.map((condition) => ({
              ...condition,
              verifierIds: ["observation", "document"].includes(condition.kind)
                ? (condition.verifierIds ?? []).filter((id) =>
                    workspace.people.some((person) => person.id === id && !person.archived),
                  )
                : [],
            })),
          })),
        }
      : { name: "", description: "", category: "", levels: [] },
  );
  const activeLevelId = draft.levels.some((level) => level.id === selectedLevelId)
    ? selectedLevelId
    : (draft.levels[0]?.id ?? "");
  const updateLevel = (id: string, update: Partial<CompetencyLevel>) =>
    setDraft((current) => ({
      ...current,
      levels: current.levels.map((level) => (level.id === id ? { ...level, ...update } : level)),
    }));
  const updateCondition = (
    levelId: string,
    conditionId: string,
    update: Partial<CompetencyCondition>,
  ) => {
    const level = draft.levels.find((item) => item.id === levelId)!;
    updateLevel(levelId, {
      conditions: level.conditions.map((condition) =>
        condition.id === conditionId ? { ...condition, ...update } : condition,
      ),
    });
  };
  const moveLevel = (index: number, delta: number) => {
    const levels = [...draft.levels];
    [levels[index], levels[index + delta]] = [levels[index + delta], levels[index]];
    setDraft({ ...draft, levels });
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-neutral-200 px-6 py-5 text-left">
          <DialogTitle>
            {t(value ? "competencies.editCompetency" : "competencies.newCompetency")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("competencies.descriptionByView.catalog")}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex min-h-0 flex-col"
          noValidate
          onSubmit={async (event) => {
            event.preventDefault();
            const invalid = event.currentTarget.querySelector<
              HTMLInputElement | HTMLTextAreaElement
            >("input:invalid, textarea:invalid, select:invalid");
            if (invalid) {
              const levelId = invalid.closest("[data-level-id]")?.getAttribute("data-level-id");
              if (levelId) setSelectedLevelId(levelId);
              requestAnimationFrame(() => invalid.reportValidity());
              return;
            }
            try {
              await onSave(draft);
              onClose();
            } catch {
              /* The mutation preserves the form and reports the error. */
            }
          }}
        >
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
                  <Label htmlFor="competency-category">{t("competencies.category")}</Label>
                  <Input
                    id="competency-category"
                    value={draft.category}
                    onChange={(event) => setDraft({ ...draft, category: event.target.value })}
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
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-5">
                <h3 className="text-base font-semibold">{t("competencies.levels")}</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const id = crypto.randomUUID();
                    setDraft({
                      ...draft,
                      levels: [...draft.levels, { id, name: "", conditions: [] }],
                    });
                    setSelectedLevelId(id);
                  }}
                >
                  {t("competencies.addLevel")}
                </Button>
              </div>
              <Tabs
                value={activeLevelId}
                onValueChange={setSelectedLevelId}
                className="min-w-0 space-y-4"
              >
                {draft.levels.length > 0 && (
                  <div className="overflow-x-auto">
                    <TabsList aria-label={t("competencies.levels")} className="justify-start">
                      {draft.levels.map((level, index) => (
                        <TabsTrigger key={level.id} value={level.id}>
                          {t("competencies.levelNumber", { number: index + 1 })}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </div>
                )}
                {draft.levels.map((level, index) => (
                  <TabsContent
                    key={level.id}
                    value={level.id}
                    forceMount
                    hidden={activeLevelId !== level.id}
                    data-level-id={level.id}
                    className="flex min-w-0 flex-col gap-4 data-[state=inactive]:hidden"
                  >
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <Label htmlFor={level.id}>{t("competencies.levelName")}</Label>
                        <Input
                          id={level.id}
                          required
                          value={level.name}
                          onChange={(event) => updateLevel(level.id, { name: event.target.value })}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={t("competencies.moveLeft")}
                        disabled={index === 0}
                        onClick={() => moveLevel(index, -1)}
                      >
                        <ArrowLeft className="size-4" aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={t("competencies.moveRight")}
                        disabled={index === draft.levels.length - 1}
                        onClick={() => moveLevel(index, 1)}
                      >
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t("competencies.remove")}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            levels: draft.levels.filter((item) => item.id !== level.id),
                          })
                        }
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                    {level.conditions.map((condition) => {
                      const sources =
                        condition.kind === "course"
                          ? workspace.courses
                          : workspace.learningResources.filter(
                              (item) => item.kind === condition.kind,
                            );
                      const isDigital = ["course", "quiz", "ai-mentor"].includes(condition.kind);
                      return (
                        <div
                          key={condition.id}
                          className="grid min-w-0 gap-3 border-t pt-4 sm:grid-cols-2"
                        >
                          <CompetenciesSelect
                            label={t("competencies.conditionKind")}
                            value={condition.kind}
                            onChange={(kind) =>
                              updateCondition(level.id, condition.id, {
                                kind: kind as CompetencyCondition["kind"],
                                resourceId: undefined,
                                minimumScore: undefined,
                                verifierIds: [],
                              })
                            }
                            options={["course", "quiz", "ai-mentor", "observation", "document"].map(
                              (value) => ({ value, label: t(`competencies.kind.${value}`) }),
                            )}
                          />
                          <div className="flex min-w-0 flex-col gap-2">
                            <Label htmlFor={`${condition.id}-description`}>
                              {t("competencies.conditionDescription")}
                            </Label>
                            <Input
                              id={`${condition.id}-description`}
                              required
                              value={condition.description}
                              onChange={(event) =>
                                updateCondition(level.id, condition.id, {
                                  description: event.target.value,
                                })
                              }
                            />
                          </div>
                          {isDigital && (
                            <CompetenciesSelect
                              label={t("competencies.learningResource")}
                              value={condition.resourceId ?? ""}
                              emptyLabel={t("competencies.notConfigured")}
                              onChange={(value) =>
                                updateCondition(level.id, condition.id, {
                                  resourceId: value || undefined,
                                })
                              }
                              options={sources.map((item) => ({
                                value: item.id,
                                label: item.name,
                              }))}
                            />
                          )}
                          {condition.kind !== "course" && isDigital && (
                            <div className="flex min-w-0 flex-col gap-2">
                              <Label htmlFor={`${condition.id}-score`}>
                                {t("competencies.minimumScore")}
                              </Label>
                              <Input
                                id={`${condition.id}-score`}
                                type="number"
                                min={0}
                                max={100}
                                value={condition.minimumScore ?? ""}
                                onChange={(event) =>
                                  updateCondition(level.id, condition.id, {
                                    minimumScore:
                                      event.target.value === ""
                                        ? undefined
                                        : Number(event.target.value),
                                  })
                                }
                              />
                            </div>
                          )}
                          {!isDigital && (
                            <div className="flex min-w-0 flex-col gap-2 sm:col-span-2">
                              <Label>{t("competencies.verifiers")}</Label>
                              <UserMultiSelect
                                value={(condition.verifierIds ?? []).filter((id) =>
                                  workspace.people.some((person) => person.id === id),
                                )}
                                onChange={(ids) => {
                                  if (!pending)
                                    updateCondition(level.id, condition.id, { verifierIds: ids });
                                }}
                                placeholder={t("competencies.verifiers")}
                                options={workspace.people
                                  .filter(
                                    (person) =>
                                      !person.archived ||
                                      condition.verifierIds?.includes(person.id),
                                  )
                                  .map((person) => ({
                                    value: person.id,
                                    label: person.name,
                                    disable: person.archived,
                                  }))}
                              />
                            </div>
                          )}
                          <Button
                            type="button"
                            className="justify-self-start sm:col-span-2"
                            variant="ghost"
                            onClick={() =>
                              updateLevel(level.id, {
                                conditions: level.conditions.filter(
                                  (item) => item.id !== condition.id,
                                ),
                              })
                            }
                          >
                            {t("competencies.removeCondition")}
                          </Button>
                        </div>
                      );
                    })}
                    <Button
                      type="button"
                      variant="outline"
                      className="self-start"
                      onClick={() =>
                        updateLevel(level.id, {
                          conditions: [
                            ...level.conditions,
                            {
                              id: crypto.randomUUID(),
                              kind: "observation",
                              description: "",
                              verifierIds: [],
                            },
                          ],
                        })
                      }
                    >
                      {t("competencies.addCondition")}
                    </Button>
                  </TabsContent>
                ))}
              </Tabs>
            </fieldset>
          </div>
          <DialogFooter className="shrink-0 gap-2 border-t border-neutral-200 px-6 py-4 sm:gap-0">
            {onArchive && (
              <Button
                type="button"
                variant="outline"
                className="sm:mr-auto text-error-800"
                disabled={pending}
                onClick={async () => {
                  try {
                    await onArchive();
                    onClose();
                  } catch {
                    /* Preserve the draft on failure. */
                  }
                }}
              >
                {t("competencies.archive")}
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
      </DialogContent>
    </Dialog>
  );
}
