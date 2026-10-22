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

import type { CompetenciesWorkspace, CompetencyAction } from "../competencies.types";

export function CompetenciesPlansTable({
  actions,
  people,
  onSelect,
}: {
  actions: CompetencyAction[];
  people: CompetenciesWorkspace["people"];
  onSelect: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <Table aria-label={t("competencies.plans")}>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-64">{t("competencies.actions")}</TableHead>
            <TableHead className="min-w-40">{t("competencies.person")}</TableHead>
            <TableHead className="min-w-32">{t("competencies.tableDueDate")}</TableHead>
            <TableHead className="min-w-32">{t("competencies.tableStatus")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {actions.map((action) => (
            <TableRow key={action.id}>
              <TableCell>
                <Button
                  variant="link"
                  className="h-auto whitespace-normal p-0 text-left font-semibold"
                  onClick={() => onSelect(action.id)}
                >
                  {action.objective}
                </Button>
              </TableCell>
              <TableCell>
                {people.find((person) => person.id === action.subjectId)?.name ??
                  t("competencies.archivedAccount")}
              </TableCell>
              <TableCell>
                {action.dueDate ? formatLocalizedDate(i18n.language, action.dueDate) : "-"}
              </TableCell>
              <TableCell>
                <Badge
                  variant="notStarted"
                  className={cn(
                    "w-fit rounded-full text-xs",
                    action.status === "completed" && "bg-success-50 text-success-800",
                    action.status === "in_progress" && "bg-warning-50 text-warning-800",
                  )}
                >
                  {t(`competencies.status.${action.status}`)}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
