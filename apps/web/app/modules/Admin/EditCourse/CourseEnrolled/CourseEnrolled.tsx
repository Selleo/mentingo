import { useParams } from "@remix-run/react";
import { COURSE_ENROLLMENT } from "@repo/shared";
import {
  useReactTable,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
} from "@tanstack/react-table";
import { format } from "date-fns";
import { Minus, User, Users } from "lucide-react";
import { startTransition, useState } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { useUnenrollCourse } from "~/api/mutations";
import { useBulkCourseEnroll } from "~/api/mutations/admin/useBulkCourseEnroll";
import { useGroupsQuerySuspense } from "~/api/queries/admin/useGroups";
import { useGroupsByCourseQuery } from "~/api/queries/admin/useGroupsByCourse";
import { useAllUsersEnrolledSuspense } from "~/api/queries/admin/useUsersEnrolled";
import { Icon } from "~/components/Icon";
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
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
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
import { cn } from "~/lib/utils";
import { SearchFilter } from "~/modules/common/SearchFilter/SearchFilter";

import { GroupEnrollModal } from "./GroupEnrollModal";
import { GroupUnenrollModal } from "./GroupUnenrollModal";

import type { Row, SortingState, RowSelectionState, ColumnDef } from "@tanstack/react-table";
import type { ReactElement, FormEvent } from "react";
import type { GetStudentsWithEnrollmentDateResponse } from "~/api/generated-api";
import type { UsersEnrolledSearchParams } from "~/api/queries/admin/useUsersEnrolled";
import type { FilterConfig, FilterValue } from "~/modules/common/SearchFilter/SearchFilter";

type EnrolledStudent = GetStudentsWithEnrollmentDateResponse["data"][number];

export const CourseEnrolled = (): ReactElement => {
  const { t } = useTranslation();
  const { id: courseId } = useParams();
  const { toast } = useToast();
  const { mutate: bulkEnroll } = useBulkCourseEnroll(courseId);
  const { mutateAsync: unenrollCourse } = useUnenrollCourse();

  const { data: groupData } = useGroupsQuerySuspense();
  const { data: enrolledGroups } = useGroupsByCourseQuery(courseId ?? "");

  const [searchParams, setSearchParams] = useState<UsersEnrolledSearchParams>({});
  const [sorting, setSorting] = useState<SortingState>([{ id: "enrolledAt", desc: true }]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const [isGroupEnrollDialogOpen, setIsGroupEnrollDialogOpen] = useState<boolean>(false);
  const [isGroupUnenrollDialogOpen, setIsGroupUnenrollDialogOpen] = useState<boolean>(false);

  const [openDropdown, setOpenDropdown] = useState(false);
  const [openGroupDropdown, setOpenGroupDropdown] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [isUnenrollDialogOpen, setIsUnenrollDialogOpen] = useState<boolean>(false);

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
      accessorKey: "groups",
      header: t("adminUsersView.field.group"),
      cell: ({ row }) => {
        const groups = row.original.groups;
        const visibleGroups = groups.slice(0, 1);
        const remainingCount = groups.length - visibleGroups.length;

        return (
          <div className="flex gap-1">
            {visibleGroups.map((group) => (
              <Badge key={group.id} variant="secondary">
                {group.name}
              </Badge>
            ))}
            {remainingCount > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="default" className="cursor-help">
                      +{remainingCount}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="p-2 rounded-lg">
                    <div className="flex flex-col gap-1 !px-0">
                      {groups.slice(1).map((group) => (
                        <Badge key={group.id} variant="secondary">
                          {group.name}
                        </Badge>
                      ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "isEnrolledByGroup",
      header: ({ column }) => (
        <SortButton<EnrolledStudent> column={column}>
          {t("adminCourseView.enrolled.table.status")}
        </SortButton>
      ),
      cell: ({ row }) => {
        const enrollmentStatus = row.original.isEnrolledByGroup
          ? COURSE_ENROLLMENT.GROUP_ENROLLED
          : row.original.enrolledAt
            ? COURSE_ENROLLMENT.ENROLLED
            : COURSE_ENROLLMENT.NOT_ENROLLED;

        const isEnrolled = enrollmentStatus !== COURSE_ENROLLMENT.NOT_ENROLLED;

        return (
          <Badge
            variant={isEnrolled ? "secondary" : "default"}
            className="w-max"
            data-testid={row.original.email}
          >
            {match(enrollmentStatus)
              .with(COURSE_ENROLLMENT.GROUP_ENROLLED, () =>
                t("adminCourseView.enrolled.statuses.enrolledByGroup"),
              )
              .with(COURSE_ENROLLMENT.ENROLLED, () =>
                t("adminCourseView.enrolled.statuses.individuallyEnrolled"),
              )
              .otherwise(() => t("adminCourseView.enrolled.statuses.notEnrolled"))}
          </Badge>
        );
      },
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
    {
      name: "groups",
      type: "multiselect",
      placeholder: t("adminUsersView.filters.placeholder.groups"),
      options:
        groupData.map((item) => ({
          value: item.id,
          label: item.name,
        })) ?? [],
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
      studentIds: Object.keys(rowSelection).filter((id) =>
        usersData.some((user) => user.id === id && !user.enrolledAt),
      ),
      studentsEnrolledByGroup: Object.keys(rowSelection).filter((id) =>
        usersData.some((user) => user.id === id && user.enrolledAt && user.isEnrolledByGroup),
      ),
    };

    if (mutationData.studentsEnrolledByGroup.length)
      toast({
        title: t("adminCourseView.enrolled.toast.alreadyEnrolledByGroup.title"),
        variant: "destructive",
      });

    if (mutationData.studentIds.length > 0) {
      bulkEnroll(mutationData);
    }

    setRowSelection({});
    setIsDialogOpen(false);
  };

  const handleUnenrollFormSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const userIds = Object.keys(rowSelection).filter((id) =>
      usersData.some((user) => user.id === id && user.enrolledAt),
    );

    if (userIds.length > 0 && courseId) {
      await unenrollCourse({ courseId, userIds });
    }

    setRowSelection({});
    setIsUnenrollDialogOpen(false);
  };

  const handleOpenUnenroll = () => setIsUnenrollDialogOpen(true);
  const handleOpenEnroll = () => setIsDialogOpen(true);
  const handleOpenGroupEnroll = () => setIsGroupEnrollDialogOpen(true);
  const handleOpenGroupUnenroll = () => setIsGroupUnenrollDialogOpen(true);

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2">
        <SearchFilter
          filters={filterConfig}
          values={searchParams}
          onChange={handleFilterChange}
          isLoading={false}
        />

        <GroupEnrollModal
          isOpen={isGroupEnrollDialogOpen}
          onOpenChange={setIsGroupEnrollDialogOpen}
          courseId={courseId ?? ""}
          groups={groupData}
          enrolledGroups={enrolledGroups}
          renderTrigger={false}
        />

        <GroupUnenrollModal
          isOpen={isGroupUnenrollDialogOpen}
          onOpenChange={setIsGroupUnenrollDialogOpen}
          courseId={courseId ?? ""}
          enrolledGroups={enrolledGroups}
          renderTrigger={false}
        />

        <DropdownMenu onOpenChange={(open) => setOpenDropdown(open)}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="flex gap-2">
              <User className="size-4" />
              {t("adminCourseView.enrolled.enroll")}
              <Icon className="size-4 text-black" name={openDropdown ? "ArrowUp" : "ArrowDown"} />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent className="w-64 rounded bg-white p-2 text-black shadow-lg transition-all duration-200">
            <DropdownMenuItem>
              <Button
                className="body-sm w-full justify-start gap-2 text-neutral-950 hover:text-neutral-950"
                variant="ghost"
                onClick={handleOpenEnroll}
              >
                <Icon name="Plus" className="size-4 text-accent-foreground" />
                {t("adminCourseView.enrolled.enrollSelected")}
              </Button>
            </DropdownMenuItem>

            <DropdownMenuItem>
              <Button
                onClick={handleOpenUnenroll}
                variant="ghost"
                className="body-sm w-full justify-start gap-2 text-error-700 hover:text-error-700"
              >
                <Minus className="size-4 text-errir-700" />
                {t("adminCourseView.enrolled.unenrollSelected")}
              </Button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu onOpenChange={(open) => setOpenGroupDropdown(open)}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="flex gap-2">
              <Users className="size-4" />
              {t("adminCourseView.enrolled.enrollGroups")}
              <Icon
                className="size-4 text-black"
                name={openGroupDropdown ? "ArrowUp" : "ArrowDown"}
              />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent className="w-64 rounded bg-white p-2 text-black shadow-lg transition-all duration-200">
            <DropdownMenuItem>
              <Button
                className="body-sm w-full justify-start gap-2 text-neutral-950 hover:text-neutral-950"
                variant="ghost"
                onClick={handleOpenGroupEnroll}
              >
                <Icon name="Plus" className="size-4 text-accent-foreground" />
                {t("adminCourseView.enrolled.enrollGroups")}
              </Button>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Button
                onClick={handleOpenGroupUnenroll}
                variant="ghost"
                className="body-sm w-full justify-start gap-2 text-error-700 hover:text-error-700"
                disabled={!enrolledGroups?.length}
              >
                <Minus className="size-4 text-error-700" />
                {t("adminCourseView.enrolled.unenrollGroups")}
              </Button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Dialog open={isUnenrollDialogOpen} onOpenChange={setIsUnenrollDialogOpen}>
          <DialogPortal>
            <DialogOverlay />
            <DialogContent>
              <DialogTitle>{t("adminCourseView.enrolled.unenrollConfirmation.title")}</DialogTitle>
              <DialogDescription>
                {t("adminCourseView.enrolled.unenrollConfirmation.description")}
              </DialogDescription>
              <form onSubmit={handleUnenrollFormSubmit}>
                <div className="flex justify-end gap-4">
                  <DialogClose>
                    <Button type="reset" variant="ghost">
                      {t("common.button.cancel")}
                    </Button>
                  </DialogClose>
                  <Button type="submit">{t("common.button.save")}</Button>
                </div>
              </form>
            </DialogContent>
          </DialogPortal>
        </Dialog>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogPortal>
            <DialogOverlay />
            <DialogContent>
              <DialogTitle>{t("adminCourseView.enrolled.confirmation.title")}</DialogTitle>
              <DialogDescription>
                {t("adminCourseView.enrolled.confirmation.description")}
              </DialogDescription>
              <form onSubmit={handleFormSubmit}>
                <div className="flex justify-end gap-4">
                  <DialogClose>
                    <Button type="reset" variant="ghost">
                      {t("common.button.cancel")}
                    </Button>
                  </DialogClose>
                  <Button type="submit">{t("common.button.save")}</Button>
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
