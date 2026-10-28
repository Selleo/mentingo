import { useTranslation } from "react-i18next";

import { Badge } from "~/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";

import { COMPETENCIES_HANDLES } from "../../../../e2e/data/competencies/handles";
import { REQUIREMENT_FILTERS, matchesRequirementFilter } from "../utils/competencySubject.utils";

import { CompetencyExpiryDetails } from "./CompetencyExpiryDetails";

import type { CompetencySubjectModel } from "../hooks/competencies-hook-models.types";

type CompetencyRequirementTableProps = Pick<
  CompetencySubjectModel,
  | "setSelectedId"
  | "requirementFilter"
  | "setRequirementFilter"
  | "requirementRows"
  | "visibleRequirementRows"
  | "statusMessage"
  | "workspace"
>;

export function CompetencyRequirementTable({
  setSelectedId,
  requirementFilter,
  setRequirementFilter,
  requirementRows,
  visibleRequirementRows,
  statusMessage,
  workspace,
}: CompetencyRequirementTableProps) {
  const { t } = useTranslation();
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 p-5 pb-4 sm:p-6 sm:pb-4">
        <div className="space-y-1">
          <h2 className="h6 text-neutral-950">{t("competencies.employee.requirementsTitle")}</h2>
          <p className="body-sm text-neutral-800">{statusMessage}</p>
        </div>
        <div
          role="radiogroup"
          aria-label={t("competencies.tableStatus")}
          className="flex flex-wrap gap-2"
        >
          {REQUIREMENT_FILTERS.map((filter) => {
            const isActive = requirementFilter === filter;
            return (
              <button
                key={filter}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => setRequirementFilter(filter)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600",
                  isActive && "border-primary-700 bg-primary-700 text-white",
                  !isActive &&
                    "border-neutral-200 bg-white text-neutral-900 hover:border-primary-300",
                )}
              >
                {t(`competencies.employee.filters.${filter}`)}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs font-semibold",
                    isActive && "bg-white/20 text-white",
                    !isActive && "bg-neutral-100 text-neutral-800",
                  )}
                >
                  {requirementRows.filter((row) => matchesRequirementFilter(row, filter)).length}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {visibleRequirementRows.length > 0 ? (
        <div className="overflow-x-auto">
          <Table aria-label={t("competencies.title")}>
            <TableHeader className="bg-neutral-50">
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col" className="details-md pl-6 text-neutral-800">
                  {t("competencies.recordKinds.competency")}
                </TableHead>
                <TableHead scope="col" className="details-md text-neutral-800">
                  {t("competencies.levelComparison")}
                </TableHead>
                <TableHead scope="col" className="details-md pr-6 text-neutral-800">
                  {t("competencies.tableStatus")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRequirementRows.map((row) => {
                const { definition, standing, currentIndex, requiredIndex } = row;
                return (
                  <TableRow
                    key={definition.id}
                    data-testid={COMPETENCIES_HANDLES.ROW(definition.id)}
                    className="cursor-pointer"
                    onClick={() => setSelectedId(definition.id)}
                  >
                    <TableCell className="min-w-48 pl-6">
                      <button
                        type="button"
                        className="flex flex-col rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                        aria-label={`${t("competencies.viewDetails")}: ${definition.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedId(definition.id);
                        }}
                      >
                        <span className="body-sm-md text-neutral-950 hover:text-primary-700">
                          {definition.name}
                        </span>
                        {definition.categoryName && (
                          <span className="details text-neutral-700">
                            {definition.categoryName}
                          </span>
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="min-w-40">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1" aria-hidden="true">
                          {definition.levels.map((level, index) => (
                            <span
                              key={level.id}
                              className={cn(
                                "h-1.5 w-5 rounded-full",
                                index <= currentIndex && "bg-primary-700",
                                index > currentIndex && "bg-neutral-200",
                              )}
                            />
                          ))}
                        </div>
                        <span className="details-md text-neutral-900">
                          {currentIndex >= 0 ? `L${currentIndex + 1}` : "-"} /{" "}
                          {requiredIndex >= 0 ? `L${requiredIndex + 1}` : "-"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="pr-6">
                      {standing.expiring && (
                        <div className="flex flex-col gap-1">
                          <Badge variant="inProgress" className="w-fit whitespace-nowrap text-xs">
                            {t("competencies.expiring")}
                          </Badge>
                          <CompetencyExpiryDetails
                            definition={definition}
                            standing={standing}
                            asOf={workspace.asOf}
                            warningDays={workspace.warningDays}
                          />
                        </div>
                      )}
                      {!standing.expiring && row.confirmed && (
                        <Badge variant="success" className="w-fit whitespace-nowrap text-xs">
                          {t("competencies.met")}
                        </Badge>
                      )}
                      {!standing.expiring && !row.confirmed && (
                        <Badge className="w-fit whitespace-nowrap border border-error-200 bg-error-50 text-xs text-error-700">
                          {t("competencies.missing")}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="body-sm border-t border-neutral-200 px-6 py-10 text-center text-neutral-800">
          {t("competencies.employee.noRequirementsInFilter")}
        </p>
      )}
    </section>
  );
}
