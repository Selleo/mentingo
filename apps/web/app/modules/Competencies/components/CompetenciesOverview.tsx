import { match } from "ts-pattern";

import { Pagination } from "~/components/Pagination/Pagination";
import { SearchInput } from "~/components/SearchInput/SearchInput";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { cn } from "~/lib/utils";

import { COMPETENCIES_HANDLES } from "../../../../e2e/data/competencies/handles";
import { CompetenciesEmpty, CompetenciesError, CompetenciesLoading } from "../CompetenciesStates";
import { useCompetenciesOverview } from "../hooks/useCompetenciesOverview";
import { OVERVIEW_VIEWS } from "../utils/competenciesOverview.utils";

import { CompetenciesGettingStarted } from "./CompetenciesGettingStarted";
import { CompetenciesMatrix } from "./CompetenciesMatrix";
import { CompetenciesPeopleTable } from "./CompetenciesPeopleTable";
import { CompetenciesProfilePicker } from "./CompetenciesProfilePicker";
import { CompetenciesReadinessFilters } from "./CompetenciesReadinessFilters";

import type { CompetenciesOverviewOptions } from "../hooks/competencies-hooks.types";

export type CompetenciesOverviewProps = CompetenciesOverviewOptions;

export function CompetenciesOverview({
  summary,
  canManage,
  onPersonOpen,
  onSetupStepStart,
}: CompetenciesOverviewProps) {
  const {
    t,
    execute,
    isPending,
    peopleSectionRef,
    search,
    setSearch,
    setProfileFilter,
    statusFilter,
    setStatusFilter,
    view,
    setView,
    page,
    setPage,
    perPage,
    setPerPage,
    profiles,
    activeProfileFilter,
    matrixQuery,
    activeQuery,
    people,
    counts,
    totalItems,
    hasFilters,
    resetPage,
    startSetupStep,
  } = useCompetenciesOverview({ summary, canManage, onPersonOpen, onSetupStepStart });
  return (
    <div className="flex flex-col gap-6">
      {canManage && <CompetenciesGettingStarted summary={summary} onStepStart={startSetupStep} />}
      <Card ref={peopleSectionRef} className="min-w-0 scroll-mt-6 overflow-hidden">
        <div className="flex flex-col gap-4 p-6 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="h6 text-neutral-950">{t("competencies.overview.peopleTitle")}</h2>
              <p className="body-sm text-neutral-800">
                {t(
                  canManage
                    ? "competencies.overview.peopleDescription"
                    : "competencies.overview.teamDescription",
                )}
              </p>
            </div>
            <div
              role="tablist"
              aria-label={t("competencies.overview.viewMode")}
              className="flex gap-1 rounded-lg bg-neutral-50 p-1"
            >
              {Object.values(OVERVIEW_VIEWS).map((item) => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={view === item}
                  data-testid={COMPETENCIES_HANDLES.OVERVIEW_VIEW(item)}
                  disabled={item === OVERVIEW_VIEWS.MATRIX && !profiles.length}
                  onClick={() => {
                    setView(item);
                    resetPage();
                  }}
                  className={cn(
                    "rounded-md px-3.5 py-1.5 text-sm font-medium text-neutral-800 transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                    view === item && "bg-white font-semibold text-primary-800 shadow-sm",
                  )}
                >
                  {t(`competencies.overview.views.${item}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchInput
              aria-label={t("competencies.searchPeople")}
              placeholder={t("competencies.searchPeople")}
              wrapperClassName="w-full sm:max-w-xs"
              className="max-w-none"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                resetPage();
              }}
            />
            {profiles.length > 0 && (
              <div className="w-full sm:w-64">
                <CompetenciesProfilePicker
                  label={t("competencies.profile")}
                  hideLabel
                  value={activeProfileFilter}
                  emptyLabel={
                    view === OVERVIEW_VIEWS.LIST
                      ? t("competencies.overview.allProfiles")
                      : undefined
                  }
                  onChange={(value) => {
                    setProfileFilter(value);
                    resetPage();
                  }}
                />
              </div>
            )}
            {hasFilters && view === OVERVIEW_VIEWS.LIST && (
              <Button
                variant="ghost"
                size="sm"
                className="self-start sm:self-auto"
                onClick={() => {
                  setSearch("");
                  setProfileFilter("");
                  setStatusFilter(null);
                  resetPage();
                }}
              >
                {t("competencies.overview.clearFilters")}
              </Button>
            )}
          </div>
        </div>
        {view === OVERVIEW_VIEWS.LIST && counts && counts.all > 0 && (
          <CompetenciesReadinessFilters
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            counts={counts}
            resetPage={resetPage}
          />
        )}
        {match(view)
          .with(OVERVIEW_VIEWS.MATRIX, () => (
            <div className="pb-2">
              {matrixQuery.data && (
                <CompetenciesMatrix
                  matrix={matrixQuery.data}
                  warningDays={summary.warningDays}
                  onPersonOpen={onPersonOpen}
                />
              )}
            </div>
          ))
          .with(OVERVIEW_VIEWS.LIST, () =>
            counts?.all === 0 && !hasFilters ? (
              <div className="px-6 pb-6">
                <CompetenciesEmpty message={t("competencies.noPeople")} />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <CompetenciesPeopleTable
                  execute={execute}
                  isPending={isPending}
                  profiles={profiles}
                  people={people}
                  canManage={canManage}
                  onPersonOpen={onPersonOpen}
                />
              </div>
            ),
          )
          .exhaustive()}
        {activeQuery.isPending && activeQuery.fetchStatus !== "idle" && (
          <div className="px-6 pb-6">
            <CompetenciesLoading label={t("competencies.loading")} />
          </div>
        )}
        {activeQuery.isError && (
          <CompetenciesError
            title={t("competencies.serviceError")}
            actionLabel={t("competencies.retry")}
            onRetry={() => void activeQuery.refetch()}
          />
        )}
        {totalItems > 0 && (
          <Pagination
            className="border-t border-neutral-200 px-6 py-3"
            totalItems={totalItems}
            itemsPerPage={perPage}
            currentPage={page}
            onPageChange={setPage}
            onItemsPerPageChange={(value) => {
              setPerPage(value);
              resetPage();
            }}
          />
        )}
      </Card>
    </div>
  );
}

export {
  OVERVIEW_VIEWS,
  STATUS_DOT_CLASS_NAMES,
  STATUS_FILTERS,
  tableHeadClassName,
  type OverviewView,
} from "../utils/competenciesOverview.utils";
