import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { formatLocalizedDate } from "~/utils/formatLocalizedDate";

import { CompetencyStatus } from "./CompetencyStatus";

import type { CompetencyMatrixPage } from "../competencies.types";

const MATRIX_STATUSES = {
  MET: "met",
  MISSING: "missing",
  EXPIRING: "expiring",
} as const;

export function CompetenciesMatrix({
  matrix,
  warningDays,
  onPersonOpen,
}: {
  matrix: CompetencyMatrixPage;
  warningDays: number | null;
  onPersonOpen: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const definitions = new Map(matrix.competencies.map((item) => [item.id, item]));
  const columns = matrix.profile.requirements.flatMap(
    (requirement) => definitions.get(requirement.competencyId) ?? [],
  );
  const levelLabel = (index: number, name?: string) =>
    index >= 0 ? `L${index + 1}${name ? ` - ${name}` : ""}` : t("competencies.noLevel");

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col gap-3">
        <div
          className="flex flex-wrap gap-4 px-6 text-xs text-neutral-800"
          aria-label={t("competencies.statusLegend")}
        >
          <span className="inline-flex items-center gap-2">
            <span className="size-2 rounded-full bg-success-600" aria-hidden="true" />
            {t("competencies.met")}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="size-2 rounded-full bg-error-600" aria-hidden="true" />
            {t("competencies.missing")}
          </span>
          {warningDays !== null && (
            <span className="inline-flex items-center gap-2">
              <span className="size-2 rounded-full bg-warning-600" aria-hidden="true" />
              {t("competencies.expiring")}
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <Table
            className="[&_td]:border-r [&_td:last-child]:border-r-0 [&_th]:border-r [&_th:last-child]:border-r-0"
            aria-label={t("competencies.matrix")}
          >
            <TableHeader className="bg-neutral-50">
              <TableRow className="hover:bg-transparent">
                <TableHead
                  scope="col"
                  className="details-md w-40 min-w-40 pl-6 text-neutral-800 sm:w-56 sm:min-w-56"
                >
                  {t("competencies.person")}
                </TableHead>
                {columns.map((item) => (
                  <TableHead
                    scope="col"
                    key={item.id}
                    className="details-md min-w-40 py-3 text-center text-neutral-800"
                  >
                    {item.name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {matrix.data.map((row) => (
                <TableRow key={row.person.id}>
                  <TableCell className="pl-6">
                    <Button
                      variant="link"
                      className="h-auto whitespace-normal p-0 text-left font-semibold text-primary-800"
                      onClick={() => onPersonOpen(row.person.id)}
                    >
                      {row.person.name}
                    </Button>
                  </TableCell>
                  {columns.map((definition) => {
                    const cell = row.cells.find((item) => item.competencyId === definition.id);
                    const currentIndex = definition.levels.findIndex(
                      (level) => level.id === cell?.currentLevelId,
                    );
                    const requiredIndex = definition.levels.findIndex(
                      (level) => level.id === cell?.requiredLevelId,
                    );
                    const status = match({ met: cell?.met, expiring: cell?.expiring })
                      .with({ expiring: true }, () => MATRIX_STATUSES.EXPIRING)
                      .with({ met: true }, () => MATRIX_STATUSES.MET)
                      .otherwise(() => MATRIX_STATUSES.MISSING);
                    const value = levelLabel(requiredIndex);
                    const label = `${t(`competencies.${status}`)}. ${t("competencies.currentLevel")}: ${levelLabel(currentIndex, definition.levels[currentIndex]?.name)}. ${t("competencies.requiredLevel")}: ${levelLabel(requiredIndex, definition.levels[requiredIndex]?.name)}`;
                    return (
                      <TableCell key={definition.id} className="py-5 text-center">
                        <Tooltip>
                          <TooltipTrigger
                            type="button"
                            aria-label={label}
                            className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-4"
                          >
                            <CompetencyStatus
                              confirmed={cell?.met ?? false}
                              expiring={cell?.expiring}
                              compact
                              label={label}
                            >
                              {value}
                            </CompetencyStatus>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm">
                            {t(`competencies.matrixStatus.${status}`)} · {value}
                          </TooltipContent>
                        </Tooltip>
                        {cell?.expiring && cell.metUntil && (
                          <p className="mt-2 text-xs text-warning-800">
                            {t("competencies.expiresOn", {
                              date: formatLocalizedDate(i18n.language, cell.metUntil),
                            })}
                          </p>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
              {!matrix.data.length && (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    className="py-12 text-center text-neutral-800"
                    colSpan={1 + columns.length}
                  >
                    {t("competencies.overview.noMatrixPeople")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </TooltipProvider>
  );
}
