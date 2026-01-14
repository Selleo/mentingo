import { Link, useNavigate } from "@remix-run/react";
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { usePromotionCodesQuery } from "~/api/queries/admin/usePromotionCodes";
import { useStripeConfigured } from "~/api/queries/useStripeConfigured";
import { PageWrapper } from "~/components/PageWrapper/PageWrapper";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { formatPrice } from "~/lib/formatters/priceFormatter";
import { setPageTitle } from "~/utils/setPageTitle";

import { useGetPromotionCodeStatus } from "./hooks/useGetPromotionCodes";

import type { TPromotionCode } from "./types";
import type { MetaFunction } from "@remix-run/react";
import type { CurrencyCode } from "~/lib/formatters/priceFormatter";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.promotionCodes");

const PromotionCodes = () => {
  const { data: isStripeConfigured, isLoading } = useStripeConfigured();
  const { data: promotionsCodes } = usePromotionCodesQuery(isStripeConfigured?.enabled);
  const { getPromotionCodeStatus } = useGetPromotionCodeStatus();

  const navigate = useNavigate();

  const { t } = useTranslation();

  useEffect(() => {
    if (!(isLoading || isStripeConfigured?.enabled)) {
      navigate("/");
    }
  }, [isStripeConfigured, navigate, isLoading]);

  const columns: ColumnDef<TPromotionCode>[] = [
    {
      accessorKey: "Code",
      header: t("adminPromotionCodesView.field.code", "Code"),
      cell: ({ row }) => row.original.code ?? "n/a",
    },
    {
      accessorKey: "Status",
      header: t("adminPromotionCodesView.field.status", "Status"),
      cell: ({ row }) => getPromotionCodeStatus(row.original) ?? "n/a",
    },
    {
      accessorKey: "Uses",
      header: t("adminPromotionCodesView.field.uses", "Uses"),
      cell: ({ row }) => row.original.timesRedeemed ?? "n/a",
    },
    {
      accessorKey: "DiscountType",
      header: t("adminPromotionCodesView.field.discountType", "Discount Type"),
      cell: ({ row }) => {
        if (row.original.coupon.percentOff) {
          return t("adminPromotionCodesView.field.discountTypePercent", "Percent");
        }
        return t("adminPromotionCodesView.field.discountTypeFixed", "Fixed");
      },
    },
    {
      accessorKey: "DiscountValue",
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
    data: promotionsCodes?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleRowClick = (id: string) => {
    navigate(`/admin/promotion-codes/${id}`);
  };

  const breadcrumbs = [
    {
      title: t("adminPromotionCodesView.breadcrumbs.promotionCodes"),
      href: "/admin/promotion-codes",
    },
  ];

  if (!isStripeConfigured?.enabled) return null;

  return (
    <PageWrapper breadcrumbs={breadcrumbs}>
      <div className="flex flex-col">
        <div className="ml-auto flex gap-3 pb-4">
          <Link to="/admin/promotion-codes/new">
            <Button variant="outline">{t("adminCoursesView.button.createNew")}</Button>
          </Link>
        </div>
        <Table className="border bg-neutral-50">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-course-id={row.original.id}
                data-state={row.getIsSelected() && "selected"}
                onClick={() => handleRowClick(row.original.id)}
                className="cursor-pointer hover:bg-neutral-100"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </PageWrapper>
  );
};

export default PromotionCodes;
