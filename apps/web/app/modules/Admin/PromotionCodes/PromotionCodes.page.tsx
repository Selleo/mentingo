import { Link, useNavigate } from "@remix-run/react";
import { type ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { usePromotionCodesQuery } from "~/api/queries/admin/usePromotionCodes";
import { useStripeConfigured } from "~/api/queries/useStripeConfigured";
import {
  DataTable,
  DataTableCard,
  DataTableEmptyState,
  DataTablePagination,
  DataTableToolbar,
  useClampedPage,
} from "~/components/DataTable";
import { PageHeader } from "~/components/PageHeader/PageHeader";
import { PageWrapper } from "~/components/PageWrapper/PageWrapper";
import { Button } from "~/components/ui/button";
import { useUrlTableState } from "~/hooks/useUrlTableState";
import { formatPrice } from "~/lib/formatters/priceFormatter";
import { setPageTitle } from "~/utils/setPageTitle";

import { PROMOTION_CODES_PAGE_HANDLES } from "../../../../e2e/data/promotion-codes/handles";

import { useGetPromotionCodeStatus } from "./hooks/useGetPromotionCodes";

import type { TPromotionCode } from "./types";
import type { MetaFunction } from "@remix-run/react";
import type { PromotionCodesParams } from "~/api/queries/admin/usePromotionCodes";
import type { CurrencyCode } from "~/lib/formatters/priceFormatter";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.promotionCodes");

const PROMOTION_CODES_PATH = "/admin/promotion-codes";
const PROMOTION_CODES_TABLE_FILTER_KEYS = [] as const;

const PromotionCodes = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: isStripeConfigured, isLoading } = useStripeConfigured();
  const { getPromotionCodeStatus } = useGetPromotionCodeStatus();

  const tableState = useUrlTableState({ filterKeys: PROMOTION_CODES_TABLE_FILTER_KEYS });
  const promotionCodesParams = useMemo<PromotionCodesParams>(
    () => ({
      page: tableState.page,
      perPage: tableState.perPage,
      ...(tableState.search && { search: tableState.search }),
    }),
    [tableState.page, tableState.perPage, tableState.search],
  );
  const { data: promotionCodesResponse, isFetching } = usePromotionCodesQuery(
    promotionCodesParams,
    isStripeConfigured?.enabled,
  );

  const totalItems = promotionCodesResponse?.pagination.totalItems;

  useClampedPage({
    page: tableState.page,
    perPage: tableState.perPage,
    totalItems,
    setPage: tableState.setPage,
  });

  useEffect(() => {
    if (!(isLoading || isStripeConfigured?.enabled)) {
      navigate("/");
    }
  }, [isStripeConfigured, navigate, isLoading]);

  const columns: ColumnDef<TPromotionCode>[] = [
    {
      accessorKey: "code",
      header: t("adminPromotionCodesView.field.code", "Code"),
      cell: ({ row }) => (
        <span className="font-medium text-neutral-950">{row.original.code ?? "n/a"}</span>
      ),
    },
    {
      id: "status",
      header: t("adminPromotionCodesView.field.status", "Status"),
      cell: ({ row }) => getPromotionCodeStatus(row.original) ?? "n/a",
    },
    {
      accessorKey: "timesRedeemed",
      header: t("adminPromotionCodesView.field.uses", "Uses"),
      cell: ({ row }) => row.original.timesRedeemed ?? "n/a",
    },
    {
      id: "discountType",
      header: t("adminPromotionCodesView.field.discountType", "Discount Type"),
      cell: ({ row }) => {
        if (row.original.coupon.percentOff) {
          return t("adminPromotionCodesView.field.discountTypePercent", "Percent");
        }
        return t("adminPromotionCodesView.field.discountTypeFixed", "Fixed");
      },
    },
    {
      id: "discountValue",
      header: t("adminPromotionCodesView.field.discountValue", "Discount Value"),
      cell: ({ row }) => {
        if (row.original.coupon.percentOff) {
          return `${row.original.coupon.percentOff} %`;
        }
        return formatPrice(
          Number(row.original.coupon.amountOff),
          row.original.coupon.currency as CurrencyCode,
        );
      },
    },
  ];

  const table = useReactTable({
    getRowId: (row) => row.id,
    data: promotionCodesResponse?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (!isStripeConfigured?.enabled) return null;

  return (
    <PageWrapper
      breadcrumbs={[
        {
          title: t("adminPromotionCodesView.breadcrumbs.promotionCodes"),
          href: PROMOTION_CODES_PATH,
        },
      ]}
    >
      <div data-testid={PROMOTION_CODES_PAGE_HANDLES.PAGE} className="flex flex-col gap-6">
        <PageHeader
          title={t("adminPromotionCodesView.breadcrumbs.promotionCodes")}
          headingTestId={PROMOTION_CODES_PAGE_HANDLES.HEADING}
          actions={
            <Link
              data-testid={PROMOTION_CODES_PAGE_HANDLES.CREATE_BUTTON}
              to={`${PROMOTION_CODES_PATH}/new`}
            >
              <Button variant="primary" className="gap-2">
                <Plus className="size-4" aria-hidden />
                {t("adminPromotionCodesView.breadcrumbs.createNew")}
              </Button>
            </Link>
          }
        />

        <DataTableCard>
          <DataTableToolbar
            searchValue={tableState.searchInput}
            onSearchChange={tableState.setSearchInput}
            searchPlaceholder={t("adminPromotionCodesView.field.code", "Code")}
            searchTestId={PROMOTION_CODES_PAGE_HANDLES.SEARCH_INPUT}
            canResetFilters={tableState.activeFilterCount > 0}
            onResetFilters={tableState.resetFilters}
          />

          <DataTable
            table={table}
            isRefreshing={isFetching && Boolean(promotionCodesResponse)}
            onRowClick={(row) => navigate(`${PROMOTION_CODES_PATH}/${row.original.id}`)}
            testId={PROMOTION_CODES_PAGE_HANDLES.TABLE}
            bodyTestId={PROMOTION_CODES_PAGE_HANDLES.TABLE_BODY}
            getRowTestId={(promotionCode) => PROMOTION_CODES_PAGE_HANDLES.row(promotionCode.id)}
            emptyState={
              promotionCodesResponse && (
                <DataTableEmptyState
                  testId={PROMOTION_CODES_PAGE_HANDLES.EMPTY_STATE}
                  onResetFilters={
                    tableState.activeFilterCount > 0 ? tableState.resetFilters : undefined
                  }
                />
              )
            }
          />

          <DataTablePagination
            totalItems={totalItems}
            itemsPerPage={tableState.perPage}
            currentPage={tableState.page}
            onPageChange={tableState.setPage}
            onItemsPerPageChange={tableState.setPerPage}
          />
        </DataTableCard>
      </div>
    </PageWrapper>
  );
};

export default PromotionCodes;
