import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useDownloadCompetenciesAttachment } from "~/api/mutations/useDownloadCompetenciesAttachment";
import { useCompetencySubjectDocuments } from "~/api/queries/useCompetencySubjectDocuments";

import {
  getDocumentLevelIndex,
  groupSubjectDocuments,
  SUBMITTED_DOCUMENTS_PAGE_SIZE,
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
  const [page, setPage] = useState(1);
  const recordsQuery = useCompetencySubjectDocuments(
    subjectId,
    { page, perPage: SUBMITTED_DOCUMENTS_PAGE_SIZE },
    showsSubmissions,
  );
  useEffect(() => setPage(1), [subjectId]);
  useEffect(() => {
    if (recordsQuery.data && !recordsQuery.isPlaceholderData)
      setPage((current) =>
        Math.min(
          current,
          Math.max(
            1,
            Math.ceil(recordsQuery.data.pagination.totalItems / SUBMITTED_DOCUMENTS_PAGE_SIZE),
          ),
        ),
      );
  }, [recordsQuery.data, recordsQuery.isPlaceholderData]);
  const required = getSubjectDocumentSteps(workspace);
  const submissions = showsSubmissions ? (recordsQuery.data?.data ?? []) : [];
  const submittedCount = showsSubmissions ? (recordsQuery.data?.pagination.totalItems ?? 0) : 0;

  const groups = groupSubjectDocuments(workspace, required, submissions);
  const levelIndexOf = getDocumentLevelIndex;

  const description = [
    required.length > 0 && t("competencies.documentsSection.toSubmit", { count: required.length }),
    submittedCount > 0 && t("competencies.documentsSection.submitted", { count: submittedCount }),
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
    submittedCount,
    page,
    setPage,
    groups,
    levelIndexOf,
    description,
    isLoadingSubmissions,
    subjectId,
  };
}
