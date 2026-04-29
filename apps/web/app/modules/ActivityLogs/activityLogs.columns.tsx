import { format } from "date-fns";
import { ChevronDown } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

import {
  getActivityLogActionConfig,
  getActivityLogActionLabel,
  getActivityLogEntityLabel,
} from "./activityLogs.utils";

import type { ActivityLogItem } from "./activityLogs.utils";
import type { ColumnDef } from "@tanstack/react-table";
import type i18next from "i18next";
import type { LucideIcon } from "lucide-react";

type ActivityLogBadgeProps = {
  label: string;
  className: string;
};

const ActivityLogBadge = ({ label, className }: ActivityLogBadgeProps) => (
  <Badge
    variant="default"
    fontWeight="medium"
    className={cn("whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] leading-none", className)}
  >
    <span>{label}</span>
  </Badge>
);

type ActivityLogActionBadgeProps = {
  icon: LucideIcon;
  label: string;
  className: string;
  iconClassName: string;
};

const ActivityLogActionBadge = ({
  icon: Icon,
  label,
  className,
  iconClassName,
}: ActivityLogActionBadgeProps) => (
  <Badge
    variant="default"
    fontWeight="medium"
    className={cn("whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] leading-none", className)}
  >
    <Icon className={cn("size-4 shrink-0", iconClassName)} aria-hidden="true" />
    <span>{label}</span>
  </Badge>
);

type ActivityLogsColumnsOptions = {
  expandedRowId: string | null;
  onToggleRow: (rowId: string) => void;
};

export const getActivityLogsColumns = (
  t: typeof i18next.t,
  { expandedRowId, onToggleRow }: ActivityLogsColumnsOptions,
): ColumnDef<ActivityLogItem>[] => [
  {
    accessorKey: "createdAt",
    header: t("activityLogsView.table.datetime"),
    cell: ({ row }) => {
      const createdAt = new Date(row.original.createdAt);

      return (
        <div className="flex min-w-0 flex-col leading-none whitespace-nowrap">
          <span className="text-sm font-semibold text-neutral-950">
            {format(createdAt, "HH:mm:ss")}
          </span>
          <span className="mt-1 text-sm text-neutral-400">{format(createdAt, "MMM d, yyyy")}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "actorEmail",
    header: t("activityLogsView.table.email"),
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-neutral-900">{row.original.actorEmail}</p>
      </div>
    ),
  },
  {
    id: "action",
    header: t("activityLogsView.table.action"),
    cell: ({ row }) => {
      const { badgeClassName, iconClassName, icon } = getActivityLogActionConfig(
        row.original.actionType,
      );

      const actionLabel = getActivityLogActionLabel(t, row.original.actionType);

      return (
        <ActivityLogActionBadge
          icon={icon}
          label={actionLabel}
          className={badgeClassName}
          iconClassName={iconClassName}
        />
      );
    },
  },
  {
    id: "resource",
    header: t("activityLogsView.table.resource"),
    cell: ({ row }) => {
      const resourceLabel = getActivityLogEntityLabel(t, row.original.resourceType);

      return (
        <ActivityLogBadge
          label={resourceLabel}
          className="border-neutral-200 bg-neutral-50 text-neutral-700"
        />
      );
    },
  },
  {
    id: "details",
    header: () => <div className="text-right">{t("activityLogsView.table.details")}</div>,
    cell: ({ row }) => {
      const isExpanded = expandedRowId === row.id;

      return (
        <div className="text-right">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 rounded-lg border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
            aria-label={t("activityLogsView.table.showDetails")}
            aria-expanded={isExpanded}
            aria-controls={`activity-log-details-${row.id}`}
            onClick={() => onToggleRow(row.id)}
          >
            <ChevronDown
              className={cn("size-4 transition-transform duration-200", isExpanded && "rotate-180")}
              aria-hidden="true"
            />
          </Button>
        </div>
      );
    },
  },
];
