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

import type { AutomationDto } from "@repo/shared";
import type { ItemsPerPageOption } from "~/components/Pagination/Pagination";

interface AutomationTableProps {
  automations: AutomationDto[];
  totalItems?: number;
  page: number;
  perPage: ItemsPerPageOption;
  loading: boolean;
  onPage: (value: number) => void;
  onPerPage: (value: string) => void;
}

export function AutomationTable(props: AutomationTableProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col">
      <Table className="border bg-neutral-50">
        <TableHeader>
          <TableRow>
            <TableHead>{t("automationView.table.name")}</TableHead>
            <TableHead>{t("automationView.table.status")}</TableHead>
            <TableHead>{t("automationView.table.updatedAt")}</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">{t("automationView.table.menu")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.loading && (
            <TableRow>
              <TableCell colSpan={4} className="py-12 text-center text-muted-foreground">
                {t("automations.loading")}
              </TableCell>
            </TableRow>
          )}
          {!props.loading &&
            props.automations.map((automation) => (
              <AutomationRow key={automation.id} automation={automation} />
            ))}
          {!props.loading && props.automations.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="py-12 text-center text-muted-foreground">
                {t("automationView.table.empty")}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <Pagination
        className="rounded-b-lg border-x border-b bg-neutral-50"
        emptyDataClassName="rounded-b-lg border-x border-b bg-neutral-50"
        totalItems={props.totalItems}
        itemsPerPage={props.perPage}
        currentPage={props.page}
        onPageChange={props.onPage}
        onItemsPerPageChange={props.onPerPage}
      />
    </div>
  );
}
