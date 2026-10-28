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
import { CONDITION_KIND_ICONS, tableHeadClassName } from "../utils/competenciesCatalog.utils";

import type { CompetencyCatalogItem } from "../competencies.types";
import type { CompetenciesCatalogModel } from "../hooks/competencies-hook-models.types";

type CompetenciesCatalogTableProps = Pick<CompetenciesCatalogModel, "competencies"> & {
  onEdit: (value: CompetencyCatalogItem) => void;
};

export function CompetenciesCatalogTable({ competencies, onEdit }: CompetenciesCatalogTableProps) {
  const { t } = useTranslation();
  return (
    <Table>
      <TableHeader className="bg-neutral-50">
        <TableRow className="hover:bg-transparent">
          <TableHead className={cn(tableHeadClassName, "pl-6")}>
            {t("competencies.recordKinds.competency")}
          </TableHead>
          <TableHead className={tableHeadClassName}>{t("competencies.category")}</TableHead>
          <TableHead className={tableHeadClassName}>{t("competencies.levels")}</TableHead>
          <TableHead className={tableHeadClassName}>
            {t("competencies.catalogTable.confirmedBy")}
          </TableHead>
          <TableHead className={cn(tableHeadClassName, "whitespace-nowrap pr-6")}>
            {t("competencies.setupSection.profilesTitle")}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {competencies.map((value) => {
          const kinds = [
            ...new Set(
              value.levels.flatMap((level) => level.conditions.map((condition) => condition.kind)),
            ),
          ];
          return (
            <TableRow key={value.id} className="cursor-pointer" onClick={() => onEdit(value)}>
              <TableCell className="min-w-64 max-w-md pl-6">
                <button
                  type="button"
                  aria-label={value.name}
                  data-testid={COMPETENCIES_HANDLES.CATALOG_CARD(value.id)}
                  className="flex flex-col rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
                  onClick={(event) => {
                    event.stopPropagation();
                    onEdit(value);
                  }}
                >
                  <span className="body-sm-md text-neutral-950">{value.name}</span>
                  {value.description && (
                    <span className="details line-clamp-1 text-neutral-700">
                      {value.description}
                    </span>
                  )}
                </button>
              </TableCell>
              <TableCell className="body-sm whitespace-nowrap text-neutral-900">
                {value.categoryName ?? "-"}
              </TableCell>
              <TableCell className="min-w-36">
                {value.levels.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1" aria-hidden="true">
                      {value.levels.map((level) => (
                        <span key={level.id} className="h-1.5 w-5 rounded-full bg-primary-300" />
                      ))}
                    </div>
                    <span
                      className="details text-neutral-800"
                      title={value.levels.map((level) => level.name).join(" → ")}
                    >
                      {t("competencies.catalogTable.levelCount", {
                        count: value.levels.length,
                      })}
                    </span>
                  </div>
                ) : (
                  <Badge variant="draft" className="text-xs">
                    {t("competencies.notConfigured")}
                  </Badge>
                )}
              </TableCell>
              <TableCell className="min-w-60">
                <div className="flex flex-wrap gap-1.5">
                  {kinds.map((kind) => {
                    const Icon = CONDITION_KIND_ICONS[kind];
                    return (
                      <span
                        key={kind}
                        className="details-md inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-neutral-100 px-2 py-0.5 text-neutral-900"
                      >
                        <Icon className="size-3.5 text-neutral-700" aria-hidden="true" />
                        {t(`competencies.kind.${kind}`)}
                      </span>
                    );
                  })}
                  {!kinds.length && <span className="details text-neutral-700">-</span>}
                </div>
              </TableCell>
              <TableCell className="body-sm pr-6 text-neutral-900">{value.profileCount}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
