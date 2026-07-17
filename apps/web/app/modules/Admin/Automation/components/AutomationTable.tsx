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

import { AutomationRow } from "./AutomationRow";

import type { Automation } from "../Automation.page";
import type { FC } from "react";
import type { ItemsPerPageOption } from "~/components/Pagination/Pagination";

interface AutomationTableProps {
  automations: Automation[];
  totalCount: number;
  onOpenDrawer: (automation: Automation) => void;
}

export const AutomationTable: FC<AutomationTableProps> = ({
  automations,
  totalCount,
  onOpenDrawer,
}) => {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<ItemsPerPageOption>(10);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = automations.slice(indexOfFirstItem, indexOfLastItem);

  const handleItemsPerPageChange = (newPerPage: string) => {
    setItemsPerPage(Number(newPerPage) as ItemsPerPageOption);
    setCurrentPage(1);
  };

  return (
    <div className="flex flex-col">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("automationView.table.name")}</TableHead>
            <TableHead>{t("automationView.table.status")}</TableHead>
            <TableHead>{t("automationView.table.trigger")}</TableHead>
            <TableHead className="min-w-[160px] text-center">
              {t("automationView.table.actions")}
            </TableHead>
            <TableHead>{t("automationView.table.lastRun")}</TableHead>
            <TableHead>{t("automationView.table.updatedAt")}</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">{t("automationView.table.menu")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {currentItems.map((item) => (
            <AutomationRow key={item.id} automation={item} onOpenDrawer={onOpenDrawer} />
          ))}
          {automations.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                {totalCount > 0
                  ? t("automationView.table.emptyFiltered")
                  : t("automationView.table.empty")}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Pagination
        className="border-b border-x bg-neutral-50 rounded-b-lg"
        emptyDataClassName="border-b border-x bg-neutral-50 rounded-b-lg"
        totalItems={automations.length}
        itemsPerPage={itemsPerPage}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={handleItemsPerPageChange}
      />
    </div>
  );
};
