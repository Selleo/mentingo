import { Paperclip } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";
import { formatLocalizedDate } from "~/utils/formatLocalizedDate";

import { COMPETENCIES_HANDLES } from "../../../../e2e/data/competencies/handles";

import { CompetenciesPersonAvatar } from "./CompetenciesPersonAvatar";

import type { CompetenciesReviewModel } from "../hooks/competencies-hook-models.types";

type CompetenciesReviewTableProps = Pick<
  CompetenciesReviewModel,
  | "filter"
  | "setSelectedId"
  | "subjectName"
  | "conditionsFor"
  | "statusVariant"
  | "decisionsFor"
  | "openDecision"
  | "rows"
  | "tableHeadClassName"
>;

export function CompetenciesReviewTable({
  filter,
  setSelectedId,
  subjectName,
  conditionsFor,
  statusVariant,
  decisionsFor,
  openDecision,
  rows,
  tableHeadClassName,
}: CompetenciesReviewTableProps) {
  const { t, i18n } = useTranslation();
  return (
    <Table aria-label={t(`competencies.reviewFilters.${filter}`)}>
      <TableHeader className="bg-neutral-50">
        <TableRow className="hover:bg-transparent">
          <TableHead className={cn(tableHeadClassName, "pl-6")}>
            {t("competencies.person")}
          </TableHead>
          <TableHead className={tableHeadClassName}>
            {t("competencies.recordKinds.competency")}
          </TableHead>
          <TableHead className={tableHeadClassName}>
            {t("competencies.reviewTable.submitted")}
          </TableHead>
          <TableHead className={cn(tableHeadClassName, "min-w-64")}>
            {t("competencies.note")}
          </TableHead>
          <TableHead className={tableHeadClassName}>{t("competencies.tableStatus")}</TableHead>
          <TableHead className="pr-6">
            <span className="sr-only">{t("competencies.actions")}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((item) => {
          const conditions = conditionsFor(item);
          return (
            <TableRow
              key={item.id}
              data-testid={COMPETENCIES_HANDLES.EVIDENCE(item.id)}
              className="cursor-pointer"
              onClick={() => setSelectedId(item.id)}
            >
              <TableCell className="pl-6">
                <span className="flex items-center gap-3">
                  <CompetenciesPersonAvatar
                    name={subjectName(item)}
                    profilePictureUrl={item.subjectProfilePictureUrl}
                  />
                  <span className="body-sm-md whitespace-nowrap text-neutral-950">
                    {subjectName(item)}
                  </span>
                </span>
              </TableCell>
              <TableCell className="min-w-48">
                <span className="body-sm-md block text-neutral-950">{item.competencyName}</span>
                {conditions[0] && (
                  <span className="details text-neutral-700">{conditions[0].levelLabel}</span>
                )}
              </TableCell>
              <TableCell className="body-sm whitespace-nowrap text-neutral-900">
                {formatLocalizedDate(i18n.language, item.occurredAt, "dd MMM yyyy")}
              </TableCell>
              <TableCell className="max-w-sm">
                <span className="flex items-center gap-2">
                  {item.attachmentId && (
                    <Paperclip
                      className="size-4 shrink-0 text-neutral-700"
                      aria-label={t("competencies.downloadEvidence")}
                    />
                  )}
                  <span className="body-sm line-clamp-1 text-neutral-900">{item.note}</span>
                </span>
              </TableCell>
              <TableCell>
                <Badge
                  variant={statusVariant(item.status)}
                  className="w-fit whitespace-nowrap text-xs"
                >
                  {t(`competencies.status.${item.status}`)}
                </Badge>
              </TableCell>
              <TableCell className="pr-6">
                <div className="flex items-center justify-end gap-2">
                  {item.status === "pending" &&
                    decisionsFor(item).map((status) => (
                      <Button
                        key={status}
                        size="sm"
                        variant={status === "approved" ? "default" : "outline"}
                        onClick={(event) => {
                          event.stopPropagation();
                          openDecision(item, status);
                        }}
                      >
                        {t(`competencies.decision.${status}`)}
                      </Button>
                    ))}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
