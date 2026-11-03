import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useCompetencyOptions } from "~/api/queries/useCompetencyOptions";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import {
  NO_OPTIONS,
  createCompetencyDraft,
  updateCompetencyCondition,
} from "../utils/competencyEditor.utils";

import type { CompetencyEditorOptions } from "./competencies-hooks.types";
import type {
  CompetencyCategory,
  CompetencyCondition,
  CompetencyInput,
  CompetencyLevel,
} from "../competencies.types";
import type { FormEvent } from "react";

export function useCompetencyEditor({
  value,
  onSave,
  onClose,
  pending,
  onDelete,
}: CompetencyEditorOptions) {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const options = useCompetencyOptions({ language }).data ?? NO_OPTIONS;

  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [categoryEditorOpen, setCategoryEditorOpen] = useState(false);
  const [createdCategory, setCreatedCategory] = useState<Pick<CompetencyCategory, "id" | "name">>();
  const [selectedLevelId, setSelectedLevelId] = useState(value?.levels[0]?.id ?? "");
  const [draft, setDraft] = useState<CompetencyInput>(() => createCompetencyDraft(value));
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
    setDraft((current) => updateCompetencyCondition(current, levelId, conditionId, update));
  };

  const saveCompetencyDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const invalid = event.currentTarget.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      "input:invalid, textarea:invalid, select:invalid",
    );
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
  };
  const deleteCompetency = async () => {
    if (!onDelete) return;
    try {
      await onDelete();
      onClose();
    } catch {
      /* The mutation reports the error and preserves the confirmation dialog. */
    }
  };
  const selectCreatedCategory = (category: Pick<CompetencyCategory, "id" | "name">) => {
    setCreatedCategory(category);
    setDraft((current) => ({ ...current, categoryId: category.id }));
  };

  return {
    categoryEditorOpen,
    setCategoryEditorOpen,
    selectCreatedCategory,
    createdCategory,
    deleteConfirmationOpen,
    setDeleteConfirmationOpen,
    deleteCompetency,
    t,
    options,
    setSelectedLevelId,
    draft,
    setDraft,
    activeLevelId,
    updateLevel,
    updateCondition,
    value,
    onSave,
    onClose,
    pending,
    onDelete,
    saveCompetencyDraft,
  };
}
