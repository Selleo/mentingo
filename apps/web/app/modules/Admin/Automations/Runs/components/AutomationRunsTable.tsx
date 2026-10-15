import { useTranslation } from "react-i18next";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

import { AutomationRunRow } from "./AutomationRunRow";

import type { AutomationRunSummary } from "@repo/shared";

export function AutomationRunsTable({
  runs,
  loading,
  onOpenDetail,
}: {
  runs: AutomationRunSummary[];
  loading: boolean;
  onOpenDetail: (automationRunId: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <Table className="border bg-neutral-50">
      <TableHeader>
        <TableRow>
          <TableHead>{t("automationLogs.table.automation")}</TableHead>
          <TableHead>{t("automationLogs.table.status")}</TableHead>
          <TableHead>{t("automationLogs.table.emails")}</TableHead>
          <TableHead>{t("automationLogs.table.ranAt")}</TableHead>
          <TableHead className="w-12">
            <span className="sr-only">{t("automationLogs.detail.title")}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading && (
          <TableRow>
            <TableCell
              colSpan={5}
              className="py-12 text-center text-muted-foreground"
              role="status"
            >
              {t("automations.loading")}
            </TableCell>
          </TableRow>
        )}
        {!loading &&
          runs.map((run) => (
            <AutomationRunRow key={run.id} run={run} onOpenDetail={onOpenDetail} />
          ))}
        {!loading && runs.length === 0 && (
          <TableRow>
            <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
              {t("automationLogs.table.empty")}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
