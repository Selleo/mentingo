import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useDownloadCompetenciesAttachment } from "~/api/mutations/useDownloadCompetenciesAttachment";

import {
  REQUIREMENT_FILTER_VALUES,
  getSubjectMessageKeys,
  getSubjectRequirements,
  matchesRequirementFilter,
} from "../utils/competencySubject.utils";

import type {
  CompetencyEvidenceDraft,
  CompetencyRevocationDraft,
  CompetencySubjectOptions,
} from "./competencies-hooks.types";
import type { RequirementFilter } from "../utils/competencySubject.utils";

export function useCompetencySubject({
  workspace,
  subjectId,
  userId,
  canManage = false,
  headerAction,
}: CompetencySubjectOptions) {
  const { t, i18n } = useTranslation();
  const { mutateAsync: download, isPending } = useDownloadCompetenciesAttachment();
  const [form, setForm] = useState<CompetencyEvidenceDraft | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [requirementFilter, setRequirementFilter] = useState<RequirementFilter>(
    REQUIREMENT_FILTER_VALUES.ALL,
  );
  const [revocation, setRevocation] = useState<CompetencyRevocationDraft | null>(null);
  const assessment = workspace.assessment;
  const standings = workspace.standings;
  const records = workspace.evidence;
  const personName = workspace.person?.name ?? t("competencies.archivedAccount");
  const profileName = workspace.profile?.name;
  const { summaryKey, statusKey } = getSubjectMessageKeys(assessment);
  const summaryMessage = t(summaryKey);
  const statusMessage = t(statusKey);
  const { activeDefinitions, canInspectCompetencies, hasNoProfile, requirementRows } =
    getSubjectRequirements(workspace, userId, canManage);
  const visibleRequirementRows = requirementRows.filter((row) =>
    matchesRequirementFilter(row, requirementFilter),
  );

  return {
    t,
    i18n,
    download,
    isPending,
    form,
    setForm,
    selectedId,
    setSelectedId,
    requirementFilter,
    setRequirementFilter,
    revocation,
    setRevocation,
    assessment,
    standings,
    records,
    personName,
    profilePictureUrl: workspace.person?.profilePictureUrl ?? null,
    profileName,
    summaryMessage,
    activeDefinitions,
    canInspectCompetencies,
    hasNoProfile,
    requirementRows,
    visibleRequirementRows,
    statusMessage,
    workspace,
    subjectId,
    userId,
    canManage,
    headerAction,
  };
}
