import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useDownloadCompetenciesAttachment } from "~/api/mutations/useDownloadCompetenciesAttachment";
import { useExecuteCompetenciesCommand } from "~/api/mutations/useExecuteCompetenciesCommand";
import { useCompetencyReviews } from "~/api/queries/useCompetencyReviews";

import {
  getReviewConditions,
  getReviewDecisions,
  getReviewStatusVariant,
  getReviewSubjectName,
  REVIEW_FILTERS,
  REVIEW_PAGE_SIZE,
} from "../utils/competenciesReview.utils";

import type {
  CompetenciesReviewOptions,
  CompetencyReviewDecisionDraft,
} from "./competencies-hooks.types";
import type { CompetencyReviewDecision, CompetencyReviewItem } from "../competencies.types";
import type { ReviewFilter } from "../utils/competenciesReview.utils";
import type { FormEvent } from "react";

export function useCompetenciesReview({ onSubject }: CompetenciesReviewOptions) {
  const { t, i18n } = useTranslation();
  const { mutateAsync: execute, isPending } = useExecuteCompetenciesCommand();
  const { mutateAsync: download } = useDownloadCompetenciesAttachment();
  const [decision, setDecision] = useState<CompetencyReviewDecisionDraft | null>(null);
  const [reason, setReason] = useState("");
  const [filter, setFilter] = useState<ReviewFilter>(REVIEW_FILTERS.PENDING);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const query = useCompetencyReviews({ status: filter, page, perPage: REVIEW_PAGE_SIZE });
  const totals = query.data?.counts;
  useEffect(() => {
    if (query.data && !query.isPlaceholderData)
      setPage((current) =>
        Math.min(
          current,
          Math.max(1, Math.ceil(query.data.pagination.totalItems / REVIEW_PAGE_SIZE)),
        ),
      );
  }, [query.data, query.isPlaceholderData]);
  const subjectName = (item: CompetencyReviewItem) => getReviewSubjectName(item, t);
  const conditionsFor = (item: CompetencyReviewItem) => getReviewConditions(item, t);
  const statusVariant = getReviewStatusVariant;
  const decisionsFor = getReviewDecisions;
  const openDecision = (item: CompetencyReviewItem, status: CompetencyReviewDecision) => {
    setReason("");
    setDecision({ evidence: item, status, requestId: crypto.randomUUID() });
  };
  const rows = query.isPlaceholderData ? [] : (query.data?.data ?? []);
  const selected = rows.find((item) => item.id === selectedId);
  const tableHeadClassName = "details-md whitespace-nowrap text-neutral-800";

  const submitReviewDecision = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!decision) return;
    try {
      await execute({
        operation: "review_evidence",
        id: decision.evidence.id,
        subjectId: decision.evidence.subjectId,
        version: decision.evidence.version,
        decision: decision.status,
        reason,
        requestId: decision.requestId,
      });
      setDecision(null);
      setSelectedId(null);
    } catch {
      /* Keep the reason for review. */
    }
  };
  return {
    t,
    i18n,
    execute,
    isPending,
    download,
    decision,
    setDecision,
    reason,
    setReason,
    filter,
    setFilter,
    setSelectedId,
    page,
    setPage,
    query,
    totals,
    subjectName,
    conditionsFor,
    statusVariant,
    decisionsFor,
    openDecision,
    rows,
    selected,
    tableHeadClassName,
    onSubject,
    submitReviewDecision,
  };
}
