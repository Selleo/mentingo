import { useParams } from "@remix-run/react";
import {
  useReactTable,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
} from "@tanstack/react-table";
import { format } from "date-fns";
import { startTransition, useState } from "react";
import { useTranslation } from "react-i18next";

import { useBulkCourseEnroll } from "~/api/mutations/admin/useBulkCourseEnroll";
import { useAllUsersEnrolledSuspense } from "~/api/queries/admin/useUsersEnrolled";
import SortButton from "~/components/TableSortButton/TableSortButton";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { formatHtmlString } from "~/lib/formatters/formatHtmlString";
import { cn } from "~/lib/utils";
import { SearchFilter } from "~/modules/common/SearchFilter/SearchFilter";

import type { Row, SortingState, RowSelectionState, ColumnDef } from "@tanstack/react-table";
import type { ReactElement, FormEvent } from "react";
import type { GetStudentsWithEnrollmentDateResponse } from "~/api/generated-api";
import type { UsersEnrolledSearchParams } from "~/api/queries/admin/useUsersEnrolled";
import type { FilterConfig, FilterValue } from "~/modules/common/SearchFilter/SearchFilter";

type EnrolledStudent = GetStudentsWithEnrollmentDateResponse["data"][number];

export const CourseEnrolled = (): ReactElement => {
  const { t } = useTranslation();
  const { id: courseId } = useParams();
  const { mutate: bulkEnroll } = useBulkCourseEnroll(courseId);

  const [searchParams, setSearchParams] = useState<UsersEnrolledSearchParams>({});
  const [sorting, setSorting] = useState<SortingState>([{ id: "enrolledAt", desc: true }]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const { data: usersData } = useAllUsersEnrolledSuspense(courseId, searchParams);

  const columns: ColumnDef<EnrolledStudent>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
    },
    {
      accessorKey: "firstName",
      header: ({ column }) => (
        <SortButton<EnrolledStudent> column={column}>
          {t("adminCourseView.enrolled.table.name")}
        </SortButton>
      ),
      cell: ({ row }) => (
        <div className="max-w-md truncate">{formatHtmlString(row.original.firstName)}</div>
      ),
    },
    {
      accessorKey: "lastName",
      header: ({ column }) => (
        <SortButton<EnrolledStudent> column={column}>
          {t("adminCourseView.enrolled.table.surname")}
        </SortButton>
      ),
      cell: ({ row }) => (
        <div className="max-w-md truncate">{formatHtmlString(row.original.lastName)}</div>
      ),
    },
    {
      accessorKey: "email",
      header: ({ column }) => (
        <SortButton column={column}>{t("adminCourseView.enrolled.table.email")}</SortButton>
      ),
      cell: ({ row }) => (
        <div className="max-w-md truncate">{formatHtmlString(row.original.email)}</div>
      ),
    },
    {
      accessorKey: "enrolledAt",
      header: ({ column }) => (
        <SortButton<EnrolledStudent> column={column}>
          {t("adminCourseView.enrolled.table.status")}
        </SortButton>
      ),
      cell: ({ row }) => (
        <Badge variant={"secondary"} className="w-max">
          {row.original.enrolledAt
            ? t("adminCourseView.enrolled.statuses.enrolled")
            : t("adminCourseView.enrolled.statuses.notEnrolled")}
        </Badge>
      ),
    },
    {
      accessorKey: "enrolledAt",
      header: ({ column }) => (
        <SortButton<EnrolledStudent> column={column}>
          {t("adminCourseView.enrolled.table.enrollmentDate")}
        </SortButton>
      ),
      cell: ({ row }) => {
        return row.original.enrolledAt ? format(new Date(row.original.enrolledAt), "PPpp") : null;
      },
    },
  ];

  const table = useReactTable({
    getRowId: (row) => row.id,
    data: usersData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      rowSelection,
    },
  });

  const filterConfig: FilterConfig[] = [
    {
      type: "text",
      name: "keyword",
      placeholder: t("adminCourseView.enrolled.filters.placeholder.searchByKeyword"),
    },
  ];

  const handleFilterChange = (name: string, value: FilterValue) => {
    startTransition(() => {
      setSearchParams((prev) => ({
        ...prev,
        [name]: value,
      }));
    });
  };

  const handleRowClick = (row: Row<EnrolledStudent>) => () => {
    row.toggleSelected(!row.getIsSelected());
  };

  const handleFormSubmit = (event: FormEvent) => {
    event.preventDefault();

    const mutationData = {
      studentIds: Object.keys(rowSelection)
        .map((idx) => idx)
        .filter((id) => usersData.some((user) => user.id === id && !user.enrolledAt)),
    };

    if (mutationData.studentIds.length > 0) {
      bulkEnroll(mutationData);
    }

    setRowSelection({});
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2">
        <SearchFilter
          filters={filterConfig}
          values={searchParams}
          onChange={handleFilterChange}
          isLoading={false}
        />

        <Dialog>
          <DialogTrigger>
            <Button
              className="border border-primary-500 bg-transparent text-primary-700"
              disabled={Object.values(rowSelection).length === 0}
            >
              {t("adminCourseView.enrolled.enrollSelected")}
            </Button>
          </DialogTrigger>
          <DialogPortal>
            <DialogOverlay />
            <DialogContent>
              <DialogTitle>{t("adminCourseView.enrolled.confirmation.title")}</DialogTitle>
              <DialogDescription>
                {t("adminCourseView.enrolled.confirmation.description")}
              </DialogDescription>
              <form onSubmit={handleFormSubmit}>
                <div className={"flex justify-end gap-4"}>
                  <DialogClose>
                    <Button type={"reset"} variant={"ghost"}>
                      {t("common.button.cancel")}
                    </Button>
                  </DialogClose>
                  <DialogClose>
                    <Button type={"submit"}>{t("common.button.save")}</Button>
                  </DialogClose>
                </div>
              </form>
            </DialogContent>
          </DialogPortal>
        </Dialog>
      </div>
      <Table className="border bg-neutral-50">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header, index) => (
                <TableHead key={header.id} className={cn({ "size-12": index === 0 })}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row: Row<EnrolledStudent>) => (
            <TableRow
              key={row.id}
              data-course-id={row.original.id}
              data-state={row.getIsSelected() && "selected"}
              onClick={handleRowClick(row)}
              className="cursor-pointer hover:bg-neutral-100"
            >
              {row.getVisibleCells().map((cell, index) => (
                <TableCell key={cell.id} className={cn({ "size-12": index === 0 })}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
