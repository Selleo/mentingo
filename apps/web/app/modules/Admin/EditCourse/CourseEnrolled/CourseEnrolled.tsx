import {
  useReactTable,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
} from "@tanstack/react-table";
import { format } from "date-fns";
import { startTransition, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAllUsersSuspense } from "~/api/queries";
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
import { USER_ROLE } from "~/config/userRoles";
import { formatHtmlString } from "~/lib/formatters/formatHtmlString";
import { cn } from "~/lib/utils";
import { useBulkCourseEnroll } from "~/modules/Admin/EditCourse/CourseEnrolled/hooks/useBulkCourseEnroll";
import { SearchFilter } from "~/modules/common/SearchFilter/SearchFilter";

import type { Row, SortingState, RowSelectionState, ColumnDef } from "@tanstack/react-table";
import type { ReactElement, FormEvent } from "react";
import type { GetUsersResponse } from "~/api/generated-api";
import type { UserRole } from "~/config/userRoles";
import type { FilterConfig, FilterValue } from "~/modules/common/SearchFilter/SearchFilter";

// TODO: create GET endpoint to get student_courses array by course_id and override this data
const courseData: { studentId: string; createdAt: string }[] = [
  {
    studentId: "f43543cc-b99c-407b-b8ad-1baac84fc203",
    createdAt: "2025-05-18 12:24:55.393 +00:00",
  },
  {
    studentId: "2da5a8b2-44b2-455f-a3bb-b163cd8823ea",
    createdAt: "2025-05-23 13:42:55.393 +00:00",
  },
];

type EnrolledStudent = GetUsersResponse["data"][number] & {
  isEnrolled: boolean;
  enrolledAt: string;
};

export const CourseEnrolled = (): ReactElement => {
  const { t } = useTranslation();
  // course id will be needed for backend queries/mutations
  // const { id: courseId } = useParams();
  const { mutate: bulkCreate } = useBulkCourseEnroll();

  const [searchParams, setSearchParams] = useState<{
    keyword?: string;
    role?: UserRole;
    archived?: boolean;
    status?: string;
  }>({});
  const [sorting, setSorting] = useState<SortingState>([{ id: "isEnrolled", desc: true }]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const { data: usersData } = useAllUsersSuspense(searchParams);

  const enrolledStudents = useMemo(
    () =>
      usersData
        .filter(({ role }) => role === USER_ROLE.student)
        .map((user) => ({
          ...user,
          isEnrolled: !!courseData.find((course) => course.studentId === user.id)?.createdAt,
          enrolledAt: courseData.find((course) => course.studentId === user.id)?.createdAt ?? "",
        })),
    [usersData],
  );

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
      accessorKey: "isEnrolled",
      header: ({ column }) => (
        <SortButton<EnrolledStudent> column={column}>
          {t("adminCourseView.enrolled.table.status")}
        </SortButton>
      ),
      cell: ({ row }) => (
        <Badge variant={"secondary"} className="w-max">
          {row.original.isEnrolled
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
    data: enrolledStudents,
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
    // TODO: handle form submitting here, pass the valid objects
    bulkCreate({ data: Object.keys(rowSelection) });
    setRowSelection({});
    event.preventDefault();
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
