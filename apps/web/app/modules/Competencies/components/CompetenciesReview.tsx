import { Pagination } from "~/components/Pagination/Pagination";
import { Card } from "~/components/ui/card";
import { cn } from "~/lib/utils";

import { CompetenciesError, CompetenciesLoading } from "../CompetenciesStates";
import { useCompetenciesReview } from "../hooks/useCompetenciesReview";
import { REVIEW_FILTERS, REVIEW_PAGE_SIZE } from "../utils/competenciesReview.utils";

import { CompetenciesReviewDecision } from "./CompetenciesReviewDecision";
import { CompetenciesReviewDetails } from "./CompetenciesReviewDetails";
import { CompetenciesReviewTable } from "./CompetenciesReviewTable";

import type { CompetenciesReviewOptions } from "../hooks/competencies-hooks.types";

export type CompetenciesReviewProps = CompetenciesReviewOptions;

export function CompetenciesReview({ onSubject }: CompetenciesReviewProps) {
  const {
    submitReviewDecision,
    t,
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
  } = useCompetenciesReview({ onSubject });
  return (
    <div className="flex flex-col gap-4">
      <Card className="min-w-0 overflow-hidden">
        <div
          role="radiogroup"
          aria-label={t("competencies.review")}
          className="flex flex-wrap gap-2 p-4"
        >
          {Object.values(REVIEW_FILTERS).map((item) => {
            const isActive = filter === item;
            const isPendingWithItems = item === REVIEW_FILTERS.PENDING && Boolean(totals?.[item]);
            return (
              <button
                key={item}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => {
                  setFilter(item);
                  setPage(1);
                }}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600",
                  isActive && "border-primary-700 bg-primary-700 text-white",
                  !isActive &&
                    "border-neutral-200 bg-white text-neutral-900 hover:border-primary-300",
                )}
              >
                {t(`competencies.reviewFilters.${item}`)}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs font-semibold",
                    isPendingWithItems && "bg-warning-400 text-neutral-950",
                    !isPendingWithItems && isActive && "bg-white/20 text-white",
                    !isPendingWithItems && !isActive && "bg-neutral-100 text-neutral-800",
                  )}
                >
                  {totals?.[item] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
        {(query.isPending || query.isPlaceholderData) && (
          <div className="border-t border-neutral-200 p-4">
            <CompetenciesLoading label={t("competencies.loading")} />
          </div>
        )}
        {query.isError && (
          <CompetenciesError
            title={t("competencies.serviceError")}
            actionLabel={t("competencies.retry")}
            onRetry={() => void query.refetch()}
          />
        )}
        {!query.isPending && !query.isError && !query.data?.pagination.totalItems && (
          <p className="body-sm border-t border-neutral-200 px-6 py-10 text-center text-neutral-800">
            {t(
              filter === REVIEW_FILTERS.PENDING
                ? "competencies.noEvidence"
                : "competencies.reviewFilters.empty",
            )}
          </p>
        )}
        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <CompetenciesReviewTable
              filter={filter}
              setSelectedId={setSelectedId}
              subjectName={subjectName}
              conditionsFor={conditionsFor}
              statusVariant={statusVariant}
              decisionsFor={decisionsFor}
              openDecision={openDecision}
              rows={rows}
              tableHeadClassName={tableHeadClassName}
            />
          </div>
        )}
        {query.data && query.data.pagination.totalItems > REVIEW_PAGE_SIZE && (
          <div className="border-t border-neutral-200 px-4 py-3">
            <Pagination
              currentPage={page}
              totalItems={query.data.pagination.totalItems}
              itemsPerPage={REVIEW_PAGE_SIZE}
              canChangeItemsPerPage={false}
              onPageChange={setPage}
            />
          </div>
        )}
      </Card>
      <CompetenciesReviewDetails
        download={download}
        decision={decision}
        setSelectedId={setSelectedId}
        subjectName={subjectName}
        conditionsFor={conditionsFor}
        statusVariant={statusVariant}
        decisionsFor={decisionsFor}
        openDecision={openDecision}
        selected={selected}
        onSubject={onSubject}
      />
      {decision && (
        <CompetenciesReviewDecision
          submitReviewDecision={submitReviewDecision}
          isPending={isPending}
          decision={decision}
          setDecision={setDecision}
          reason={reason}
          setReason={setReason}
          subjectName={subjectName}
        />
      )}
    </div>
  );
}
