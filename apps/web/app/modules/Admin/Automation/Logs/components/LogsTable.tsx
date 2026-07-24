import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Pagination } from "~/components/Pagination/Pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

import { LogRow } from "./LogRow";

import type { AutomationLogEntry } from "../automationLogs.types";
import type { FC } from "react";
import type { ItemsPerPageOption } from "~/components/Pagination/Pagination";

interface LogsTableProps {
  logs: AutomationLogEntry[];
  onOpenDetail: (log: AutomationLogEntry) => void;
}

export const LogsTable: FC<LogsTableProps> = ({ logs, onOpenDetail }) => {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<ItemsPerPageOption>(10);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = logs.slice(indexOfFirstItem, indexOfLastItem);

  const handleItemsPerPageChange = (newPerPage: string) => {
    setItemsPerPage(Number(newPerPage) as ItemsPerPageOption);
    setCurrentPage(1);
  };

  return (
    <div className="flex flex-col">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("automationLogs.table.automation")}</TableHead>
            <TableHead>{t("automationLogs.table.status")}</TableHead>
            <TableHead>{t("automationLogs.table.emails")}</TableHead>
            <TableHead>{t("automationLogs.table.ranAt")}</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">{t("automationLogs.table.details")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {currentItems.map((log) => (
            <LogRow key={log.id} log={log} onOpenDetail={onOpenDetail} />
          ))}
          {logs.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                {t("automationLogs.table.empty")}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Pagination
        className="border-b border-x bg-neutral-50 rounded-b-lg"
        emptyDataClassName="border-b border-x bg-neutral-50 rounded-b-lg"
        totalItems={logs.length}
        itemsPerPage={itemsPerPage}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={handleItemsPerPageChange}
      />
    </div>
  );
};
