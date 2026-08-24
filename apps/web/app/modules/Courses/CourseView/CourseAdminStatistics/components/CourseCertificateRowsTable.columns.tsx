import { COURSE_CERTIFICATE_STATUSES } from "@repo/shared";
import { Eye } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { UserAvatar } from "~/components/UserProfile/UserAvatar";
import { formatCertificateDate } from "~/utils/formatCertificateDate";

import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";
import type { GetCourseCertificateRowsResponse } from "~/api/generated-api";

export type CourseCertificateRow = GetCourseCertificateRowsResponse["data"][number];
type BadgeVariant = "notStarted" | "success" | "inProgress" | "destructive";

const STATUS_BADGE_VARIANTS: Record<CourseCertificateRow["status"], BadgeVariant> = {
  [COURSE_CERTIFICATE_STATUSES.NOT_EARNED]: "notStarted",
  [COURSE_CERTIFICATE_STATUSES.ACTIVE]: "success",
  [COURSE_CERTIFICATE_STATUSES.EXPIRED]: "inProgress",
  [COURSE_CERTIFICATE_STATUSES.REVOKED]: "destructive",
};

export const getCourseCertificateColumns = (
  t: TFunction,
  onPreview: (row: CourseCertificateRow) => void,
): ColumnDef<CourseCertificateRow>[] => [
  {
    accessorKey: "learnerName",
    header: t("adminCourseView.statistics.certificates.learner"),
    cell: ({ row }) => (
      <div className="flex max-w-md items-center gap-2 truncate">
        <UserAvatar className="size-7" userName={row.original.learnerName} />
        <span className="truncate">{row.original.learnerName}</span>
      </div>
    ),
  },
  {
    accessorKey: "learnerEmail",
    header: t("adminCourseView.statistics.certificates.email"),
    cell: ({ row }) => <span className="whitespace-nowrap">{row.original.learnerEmail}</span>,
  },
  {
    accessorKey: "groups",
    header: t("adminCourseView.statistics.certificates.groups"),
    cell: ({ row }) => {
      const groups = row.original.groups;
      if (!groups.length) return <span className="text-muted-foreground">—</span>;

      return (
        <div className="flex w-max gap-1 whitespace-nowrap">
          <Badge variant="secondary">{groups[0]}</Badge>
          {groups.length > 1 && (
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="default" className="cursor-help">
                  +{groups.length - 1}
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="flex flex-col gap-1 p-2">
                {groups.slice(1).map((group) => (
                  <Badge key={group} variant="secondary">
                    {group}
                  </Badge>
                ))}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: t("adminCourseView.statistics.certificates.status"),
    cell: ({ row }) => (
      <Badge variant={STATUS_BADGE_VARIANTS[row.original.status]} className="w-max">
        {t(`adminCourseView.statistics.certificates.statuses.${row.original.status}`)}
      </Badge>
    ),
  },
  {
    accessorKey: "expiresAt",
    header: t("adminCourseView.statistics.certificates.expiry"),
    cell: ({ row }) => formatCertificateDate(row.original.expiresAt) || "—",
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) =>
      row.original.previewAllowed && (
        <div className="text-right">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("adminCourseView.statistics.certificates.preview")}
            onClick={() => onPreview(row.original)}
          >
            <Eye className="size-4" />
          </Button>
        </div>
      ),
  },
];
