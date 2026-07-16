import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

import { AutomationPagination } from "./AutomationPagination";
import { AutomationRow } from "./AutomationRow";

import type { Automation } from "../Automation.page";
import type { FC } from "react";

interface AutomationTableProps {
  automations: Automation[];
  onOpenDrawer: (automation: Automation) => void;
}

export const AutomationTable: FC<AutomationTableProps> = ({ automations, onOpenDrawer }) => {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = automations.slice(indexOfFirstItem, indexOfLastItem);

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
                {t("automationView.table.empty")}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {automations.length > 0 && (
        <AutomationPagination
          totalItems={automations.length}
          itemsPerPage={itemsPerPage}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
};
