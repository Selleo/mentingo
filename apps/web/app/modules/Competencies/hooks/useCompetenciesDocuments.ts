import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useDownloadCompetenciesAttachment } from "~/api/mutations/useDownloadCompetenciesAttachment";
import { useCompetencySubjectDocuments } from "~/api/queries/useCompetencySubjectDocuments";

import {
  getDocumentLevelIndex,
  groupSubjectDocuments,
  SUBMITTED_DOCUMENTS_PAGE,
} from "../utils/competenciesDocuments.utils";
import { getSubjectDocumentSteps } from "../utils/competenciesPlans.utils";

import type {
  CompetenciesDocumentsOptions,
  CompetencyDocumentSubmission,
} from "./competencies-hooks.types";

export function useCompetenciesDocuments({
  workspace,
  subjectId,
  userId,
}: CompetenciesDocumentsOptions) {
  const { t, i18n } = useTranslation();
  const { mutateAsync: download, isPending: downloading } = useDownloadCompetenciesAttachment();
  const [submission, setSubmission] = useState<CompetencyDocumentSubmission | null>(null);
  const canSubmit = subjectId === userId || workspace.canPlan;
  const showsSubmissions = subjectId !== userId;
  const recordsQuery = useCompetencySubjectDocuments(
    subjectId,
    SUBMITTED_DOCUMENTS_PAGE,
    showsSubmissions,
  );
  const required = getSubjectDocumentSteps(workspace);
  const submissions = showsSubmissions ? (recordsQuery.data?.data ?? []) : [];

  const groups = groupSubjectDocuments(workspace, required, submissions);
  const levelIndexOf = getDocumentLevelIndex;

  const description = [
    required.length > 0 && t("competencies.documentsSection.toSubmit", { count: required.length }),
    submissions.length > 0 &&
      t("competencies.documentsSection.submitted", { count: submissions.length }),
  ]
    .filter(Boolean)
    .join(" · ");
  const isLoadingSubmissions = showsSubmissions && recordsQuery.isPending;

  return {
    t,
    i18n,
    download,
    downloading,
    submission,
    setSubmission,
    canSubmit,
    showsSubmissions,
    recordsQuery,
    submissions,
    groups,
    levelIndexOf,
    description,
    isLoadingSubmissions,
    subjectId,
  };
}
