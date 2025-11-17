import { Link, useLoaderData, useNavigate } from "@remix-run/react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { isAxiosError } from "axios";
import { format } from "date-fns";
import { isEmpty } from "lodash-es";
import { Trash } from "lucide-react";
import React, { startTransition, useState } from "react";
import { useTranslation } from "react-i18next";

import { useDeleteCourse } from "~/api/mutations/admin/useDeleteCourse";
import { useDeleteManyCourses } from "~/api/mutations/admin/useDeleteManyCourses";
import { categoriesQueryOptions } from "~/api/queries";
import { useCoursesSuspense, ALL_COURSES_QUERY_KEY } from "~/api/queries/useCourses";
import { queryClient } from "~/api/queryClient";
import { ButtonGroup } from "~/components/ButtonGroup/ButtonGroup";
import { PageWrapper } from "~/components/PageWrapper/PageWrapper";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { useToast } from "~/components/ui/use-toast";
import { formatHtmlString } from "~/lib/formatters/formatHtmlString";
import { formatPrice } from "~/lib/formatters/priceFormatter";
import { cn } from "~/lib/utils";
import {
  type FilterConfig,
  type FilterValue,
  SearchFilter,
} from "~/modules/common/SearchFilter/SearchFilter";
import { DashboardIcon, HamburgerIcon } from "~/modules/icons/icons";
import { getCurrencyLocale } from "~/utils/getCurrencyLocale";
import { setPageTitle } from "~/utils/setPageTitle";
import { handleRowSelectionRange } from "~/utils/tableRangeSelection";

import { getCourseBadgeVariant, getCourseStatus } from "./utils";

import type { ClientLoaderFunctionArgs, MetaFunction } from "@remix-run/react";
import type { GetAllCoursesResponse } from "~/api/generated-api";
import type { CourseParams, CourseStatus } from "~/api/queries/useCourses";

type TCourse = GetAllCoursesResponse["data"][number];

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.courses");

export const clientLoader = async (_: ClientLoaderFunctionArgs) => {
  try {
    const { data } = await queryClient.fetchQuery(categoriesQueryOptions());
    return data;
  } catch (error) {
    console.error("Error fetching categories:", error);

    throw new Error("Failed to load categories.");
  }
};

const Courses = () => {
  const categories = useLoaderData<typeof clientLoader>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useState<CourseParams>({});

  const { data } = useCoursesSuspense(searchParams);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const { t } = useTranslation();
  const [lastSelectedRowIndex, setLastSelectedRowIndex] = React.useState<number>(0);

  const filterConfig: FilterConfig[] = [
    {
      name: "title",
      type: "text",
      placeholder: t("adminCoursesView.filters.placeholder.title"),
    },
    {
      name: "category",
      type: "select",
      placeholder: t("adminCoursesView.filters.placeholder.categories"),
      options: categories?.map(({ title }) => ({
        value: title,
        label: title,
      })),
    },
    {
      name: "state",
      type: "select",
      placeholder: t("adminCoursesView.filters.placeholder.states"),
      options: [
        { value: "draft", label: t("adminCoursesView.filters.other.draft") },
        { value: "published", label: t("adminCoursesView.filters.other.published") },
        { value: "private", label: t("adminCoursesView.filters.other.private") },
      ],
    },
    {
      name: "archived",
      type: "status",
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

  const columns: ColumnDef<TCourse>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row, table }) => (
        <Checkbox
          checked={row.getIsSelected()}
          aria-label="Select row"
          data-testid={row.original.authorEmail}
          onClick={(event) => {
            event.stopPropagation();
            handleRowSelectionRange({
              table,
              event,
              id: row.id,
              idx: row.index,
              value: row.getIsSelected(),
              lastSelectedRowIndex,
              setLastSelectedRowIndex,
            });
          }}
        />
      ),
      enableSorting: false,
    },
    {
      accessorKey: "title",
      header: ({ column }) => (
        <SortButton<TCourse> column={column}>{t("adminCoursesView.field.title")}</SortButton>
      ),
      cell: ({ row }) => (
        <div className="max-w-md truncate">{formatHtmlString(row.original.title)}</div>
      ),
    },
    {
      accessorKey: "author",
      header: ({ column }) => (
        <SortButton<TCourse> column={column}>{t("adminCoursesView.field.author")}</SortButton>
      ),
    },
    {
      accessorKey: "category",
      header: ({ column }) => (
        <SortButton<TCourse> column={column}>{t("adminCoursesView.field.category")}</SortButton>
      ),
    },
    {
      accessorKey: "priceInCents",
      header: ({ column }) => (
        <SortButton<TCourse> column={column}>{t("adminCoursesView.field.price")}</SortButton>
      ),
      cell: ({ row }) => {
        return formatPrice(
          row.original.priceInCents,
          row.original.currency,
          getCurrencyLocale(row.original.currency),
        );
      },
    },
    {
      accessorKey: "status",
      header: t("adminCoursesView.field.state"),
      cell: ({ row }) => (
        <Badge
          variant={getCourseBadgeVariant(row.original.status as CourseStatus)}
          className="w-max"
        >
          {getCourseStatus(row.original.status as CourseStatus, t)}
        </Badge>
      ),
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <SortButton<TCourse> column={column}>{t("adminCoursesView.field.createdAt")}</SortButton>
      ),
      cell: ({ row }) => row.original.createdAt && format(new Date(row.original.createdAt), "PPpp"),
    },
  ];

  const table = useReactTable({
    getRowId: (row) => row.id,
    data,
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

  const { toast } = useToast();

  const selectedCourses = table.getSelectedRowModel().rows.map((row) => row.original.id);

  const { mutate: deleteCourse } = useDeleteCourse();
  const { mutate: deleteManyCourses } = useDeleteManyCourses();
  const handleDeleteCourses = () => {
    if (selectedCourses.length === 1) {
      deleteCourse(selectedCourses[0], {
        onSuccess: () => {
          setRowSelection({});
          queryClient.invalidateQueries({ queryKey: ALL_COURSES_QUERY_KEY });
          toast({
            title: t("adminCoursesView.toast.deleteCourseSuccessfully"),
          });
        },
        onError: (error) => {
          console.error("Error deleting courses:", error);

          if (
            isAxiosError(error) &&
            error.response?.data.message === "You can't delete a published course"
          ) {
            return toast({
              title: t("adminCoursesView.toast.deletePublishedCourseFailed"),
            });
          }
          toast({
            title: t("adminCoursesView.toast.deleteCourseFailed"),
          });
        },
      });
    } else {
      deleteManyCourses(selectedCourses, {
        onSuccess: () => {
          setRowSelection({});
          queryClient.invalidateQueries({ queryKey: ALL_COURSES_QUERY_KEY });
        },
        onError: (error) => {
          console.error("Error deleting courses:", error);
          if (
            isAxiosError(error) &&
            error.response?.data.message === "You can't delete a published course"
          ) {
            return toast({
              title: t("adminCoursesView.toast.deletePublishedCourseFailed"),
            });
          }

          toast({
            title: t("adminCoursesView.toast.deleteCourseFailed"),
          });
        },
      });
    }
  };

  const getDeleteModalTitle = () => {
    if (selectedCourses.length === 1) {
      return t("adminCoursesView.deleteModal.titleSingle");
    }
    return t("adminCoursesView.deleteModal.titleMultiple");
  };

  const getDeleteModalDescription = () => {
    if (selectedCourses.length === 1) {
      return t("adminCoursesView.deleteModal.descriptionSingle");
    }
    return t("adminCoursesView.deleteModal.descriptionMultiple", { count: selectedCourses.length });
  };

  const handleRowClick = (courseId: string) => {
    navigate(`/admin/beta-courses/${courseId}`);
  };

  return (
    <PageWrapper
      breadcrumbs={[
        {
          title: t("adminCourseView.breadcrumbs.dashboard"),
          href: "/",
        },
        {
          title: t("adminCourseView.breadcrumbs.courses"),
          href: "/admin/courses",
        },
      ]}
    >
      <div className="flex flex-col">
        <div className="flex flex-col lg:p-0 mb-6">
          <h4 className="pb-1 h4 text-neutral-950">{t("adminCoursesView.courses.header")}</h4>
          <p className="body-lg-md text-neutral-800">{t("adminCoursesView.courses.subHeader")}</p>
        </div>
        <div className="ml-auto flex gap-3">
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger>
                <Button variant="outline" disabled>
                  {t("adminCoursesView.button.uploadScorm")}
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                align="center"
                className="rounded bg-black px-2 py-1 text-sm text-white shadow-md"
              >
                {t("common.tooltip.soon")}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Link to="/admin/beta-courses/new">
            <Button variant="primary">{t("adminCoursesView.button.createNew")}</Button>
          </Link>

          <ButtonGroup
            className="not-sr-only"
            buttons={[
              {
                children: <DashboardIcon />,
                isActive: false,
                onClick: () => navigate("/courses"),
              },
              {
                children: <HamburgerIcon />,
                isActive: true,
                onClick: () => navigate("/admin/courses"),
              },
            ]}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <SearchFilter
            filters={filterConfig}
            values={searchParams}
            onChange={handleFilterChange}
            isLoading={false}
          />
          <div className="ml-auto flex items-center gap-x-2 px-4 py-2">
            <p
              className={cn("text-sm", {
                "text-neutral-900": !isEmpty(selectedCourses),
                "text-neutral-500": isEmpty(selectedCourses),
              })}
            >
              {t("common.other.selected")} ({selectedCourses.length})
            </p>

            <Dialog>
              <DialogTrigger disabled={isEmpty(selectedCourses)}>
                <Button
                  size="sm"
                  className="flex items-center gap-x-2"
                  variant="outline"
                  disabled={isEmpty(selectedCourses)}
                >
                  <Trash className="size-3" />
                  <span className="text-xs">{t("adminCoursesView.button.deleteSelected")}</span>
                </Button>
              </DialogTrigger>
              <DialogPortal>
                <DialogOverlay className="bg-primary-400 opacity-65" />
                <DialogContent className="max-w-md">
                  <DialogTitle className="text-xl font-semibold text-neutral-900">
                    {getDeleteModalTitle()}
                  </DialogTitle>
                  <DialogDescription className="mt-2 text-sm text-neutral-600">
                    {getDeleteModalDescription()}
                  </DialogDescription>
                  <div className="mt-6 flex justify-end gap-4">
                    <DialogClose>
                      <Button variant="ghost" className="text-primary-800">
                        {t("common.button.cancel")}
                      </Button>
                    </DialogClose>
                    <DialogClose>
                      <Button
                        onClick={handleDeleteCourses}
                        className="bg-error-500 text-white hover:bg-error-600"
                      >
                        {t("common.button.delete")}
                      </Button>
                    </DialogClose>
                  </div>
                </DialogContent>
              </DialogPortal>
            </Dialog>
          </div>
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
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-course-id={row.original.id}
                data-state={row.getIsSelected() && "selected"}
                onClick={() => handleRowClick(row.original.id)}
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
    </PageWrapper>
  );
};

export default Courses;
