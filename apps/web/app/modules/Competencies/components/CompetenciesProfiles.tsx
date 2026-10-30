import { Plus } from "lucide-react";

import { Pagination } from "~/components/Pagination/Pagination";
import { SearchInput } from "~/components/SearchInput/SearchInput";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

import { COMPETENCIES_HANDLES } from "../../../../e2e/data/competencies/handles";
import { CompetenciesEmpty, CompetenciesError, CompetenciesLoading } from "../CompetenciesStates";
import { useCompetenciesProfiles } from "../hooks/useCompetenciesProfiles";

import { CompetenciesCompetencyPicker } from "./CompetenciesCompetencyPicker";

import type { CompetenciesProfilesOptions } from "../hooks/competencies-hooks.types";

export type CompetenciesProfilesProps = CompetenciesProfilesOptions;

export function CompetenciesProfiles({ onEdit, onCreate }: CompetenciesProfilesProps) {
  const {
    t,
    search,
    setSearch,
    competencyId,
    setCompetencyId,
    page,
    setPage,
    perPage,
    setPerPage,
    hasCompetencies,
    query,
    profiles,
    totalItems,
    hasFilters,
  } = useCompetenciesProfiles();
  if (query.isPending)
    return (
      <div className="p-6">
        <CompetenciesLoading label={t("competencies.loading")} />
      </div>
    );
  if (query.isError)
    return (
      <div className="p-6">
        <CompetenciesError
          title={t("competencies.serviceError")}
          actionLabel={t("competencies.retry")}
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  if (!totalItems && !hasFilters)
    return (
      <div className="p-6">
        <CompetenciesEmpty
          title={t("competencies.setupSection.emptyProfilesTitle")}
          message={t(
            onCreate
              ? "competencies.setupSection.emptyProfiles"
              : "competencies.setupSection.emptyProfilesNeedsCompetencies",
          )}
          action={
            onCreate && (
              <Button onClick={onCreate}>
                <Plus className="mr-2 size-4" aria-hidden="true" />
                {t("competencies.newProfile")}
              </Button>
            )
          }
        />
      </div>
    );

  return (
    <div aria-label={t("competencies.profiles")} className="min-w-0 overflow-hidden">
      <div className="flex flex-col gap-3 px-6 pb-6 pt-4 sm:flex-row sm:items-center">
        <SearchInput
          aria-label={t("competencies.searchProfiles")}
          placeholder={t("competencies.searchProfiles")}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          wrapperClassName="w-full sm:max-w-xs"
          className="max-w-none"
        />
        {hasCompetencies && (
          <CompetenciesCompetencyPicker
            label={t("competencies.recordKinds.competency")}
            hideLabel
            className="w-full sm:w-56"
            value={competencyId}
            emptyLabel={t("competencies.profilesTable.allCompetencies")}
            onChange={(value) => {
              setCompetencyId(value);
              setPage(1);
            }}
          />
        )}
        {onCreate && (
          <Button
            className="sm:ml-auto"
            data-testid={COMPETENCIES_HANDLES.ADD_PROFILE}
            onClick={onCreate}
          >
            <Plus className="mr-2 size-4" aria-hidden="true" />
            {t("competencies.newProfile")}
          </Button>
        )}
      </div>
      {profiles.length === 0 ? (
        <p className="body-sm border-t border-neutral-200 px-6 py-10 text-center text-neutral-800">
          {t("competencies.noSearchResults")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-neutral-50">
              <TableRow className="hover:bg-transparent">
                <TableHead
                  scope="col"
                  className="details-md whitespace-nowrap pl-6 text-neutral-800"
                >
                  {t("competencies.profile")}
                </TableHead>
                <TableHead scope="col" className="details-md whitespace-nowrap text-neutral-800">
                  {t("competencies.setupSection.requiredCompetenciesCount")}
                </TableHead>
                <TableHead
                  scope="col"
                  className="details-md whitespace-nowrap pr-6 text-neutral-800"
                >
                  {t("competencies.setupSection.assignedPeople")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((profile) => (
                <TableRow
                  key={profile.id}
                  className="cursor-pointer"
                  onClick={() => onEdit(profile)}
                >
                  <TableCell className="min-w-64 max-w-md pl-6">
                    <button
                      type="button"
                      aria-label={`${t("competencies.edit")}: ${profile.name}`}
                      className="flex flex-col rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEdit(profile);
                      }}
                    >
                      <span className="body-sm-md text-neutral-950">{profile.name}</span>
                      {profile.description && (
                        <span className="details line-clamp-1 text-neutral-700">
                          {profile.description}
                        </span>
                      )}
                    </button>
                  </TableCell>
                  <TableCell className="body-sm text-neutral-900">
                    {profile.requirements.length}
                  </TableCell>
                  <TableCell className="body-sm pr-6 text-neutral-900">
                    {profile.assignedPeopleCount}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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
            setPage(1);
          }}
        />
      )}
    </div>
  );
}

export { CompetenciesProfileEditor } from "./CompetenciesProfileEditor";
