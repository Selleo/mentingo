import { Link } from "@remix-run/react";
import { Check, Minus, MoreVertical, Pencil, Trash2, TrendingDown, TrendingUp } from "lucide-react";

import SortButton from "~/components/TableSortButton/TableSortButton";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { SupportModePopover } from "~/modules/SuperAdmin/SupportModePopover";

import { TENANTS_PAGE_HANDLES } from "../../../e2e/data/tenants/handles";

import type { ColumnDef } from "@tanstack/react-table";
import type i18next from "i18next";
import type { FindAllTenantsResponse } from "~/api/generated-api";

export type Tenant = FindAllTenantsResponse["data"][number] & { isCurrentTenant?: boolean };

const HOST_PROTOCOL_PATTERN = /^https?:\/\//i;

const HostPreview = ({ host }: { host: string }) => {
  const displayHost = host.replace(HOST_PROTOCOL_PATTERN, "");

  if (displayHost.length <= 25) {
    return <span>{displayHost}</span>;
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="block max-w-[25ch] cursor-help truncate text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            type="button"
          >
            {displayHost}
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm break-all" sideOffset={6}>
          {displayHost}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const LastActivityPreview = ({
  tenant,
  dateTimeFormatter,
  t,
}: {
  tenant: Tenant;
  dateTimeFormatter: Intl.DateTimeFormat;
  t: typeof i18next.t;
}) => {
  if (!tenant.lastActivity) return <span className="text-muted-foreground">—</span>;

  const occurredAt = dateTimeFormatter.format(new Date(tenant.lastActivity.occurredAt));

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="w-full min-w-48 rounded-md border border-dotted border-neutral-300 px-2 py-1.5 text-left outline-none transition-colors hover:border-neutral-400 hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            data-testid={TENANTS_PAGE_HANDLES.lastActivity(tenant.id)}
          >
            <span className="block whitespace-nowrap font-medium text-neutral-900">
              {occurredAt}
            </span>
            <span className="block max-w-64 truncate text-xs text-muted-foreground">
              {tenant.lastActivity.actorEmail}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent
          align="start"
          className="w-80 rounded-lg p-0"
          data-testid={TENANTS_PAGE_HANDLES.recentActivitiesPreview(tenant.id)}
          side="bottom"
          sideOffset={8}
        >
          <p className="border-b border-neutral-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-600">
            {t("superAdminTenantsView.table.recentActivities")}
          </p>
          <ol className="divide-y divide-neutral-100">
            {tenant.recentActivities.map((activity) => (
              <li key={activity.id} className="px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-neutral-900">
                    {t(`activityLogsView.actions.${activity.actionType}`, {
                      defaultValue: activity.actionType,
                    })}
                  </span>
                  <time className="shrink-0 text-xs text-neutral-500">
                    {dateTimeFormatter.format(new Date(activity.occurredAt))}
                  </time>
                </div>
                <p className="mt-0.5 truncate text-xs text-neutral-500">{activity.actorEmail}</p>
              </li>
            ))}
          </ol>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const ActivityTrend = ({
  percentage,
  tenantId,
  t,
}: {
  percentage: number | null;
  tenantId: string;
  t: typeof i18next.t;
}) => {
  if (percentage === null || percentage === 0) return null;

  let TrendIcon = TrendingUp;
  let label = t("superAdminTenantsView.activityTrend.increase", { percentage });
  let colorClassName = "text-success-700";

  if (percentage < 0) {
    TrendIcon = TrendingDown;
    label = t("superAdminTenantsView.activityTrend.decrease", {
      percentage: Math.abs(percentage),
    });
    colorClassName = "text-error-700";
  }

  return (
    <span
      aria-label={label}
      className={cn(
        "inline-flex self-center items-center gap-1 text-sm font-semibold leading-none tabular-nums",
        colorClassName,
      )}
      data-testid={TENANTS_PAGE_HANDLES.activityTrend(tenantId)}
      title={label}
    >
      <TrendIcon className="size-5 shrink-0" aria-hidden="true" />
      {Math.abs(percentage)}%
    </span>
  );
};

export const getTenantsColumns = (
  t: typeof i18next.t,
  onSupportLogin: (tenantId: string, targetUserId: string) => Promise<void>,
  isSupportLoginLoading: boolean,
  language: string,
  onRequestDelete: (tenant: Tenant) => void,
): ColumnDef<Tenant>[] => {
  const dateTimeFormatter = new Intl.DateTimeFormat(language, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return [
    {
      accessorKey: "name",
      header: t("superAdminTenantsView.table.name"),
    },
    {
      accessorKey: "host",
      header: t("superAdminTenantsView.table.host"),
      cell: ({ row }) => <HostPreview host={row.original.host} />,
    },
    {
      accessorKey: "status",
      header: t("superAdminTenantsView.table.status"),
      cell: ({ row }) => {
        const isActive = row.original.status === "active";

        const label = isActive
          ? t("superAdminTenantsView.status.active")
          : t("superAdminTenantsView.status.inactive");

        return <Badge variant={isActive ? "success" : "notStarted"}>{label}</Badge>;
      },
    },
    {
      accessorKey: "isManaging",
      header: () => <div className="text-center">{t("superAdminTenantsView.table.managing")}</div>,
      cell: ({ row }) => {
        const label = row.original.isManaging
          ? t("superAdminTenantsView.table.yes")
          : t("superAdminTenantsView.table.no");

        return (
          <div className="flex justify-center" aria-label={label} role="img" title={label}>
            {row.original.isManaging ? (
              <Check className="size-5 text-success-600" aria-hidden="true" />
            ) : (
              <Minus className="size-5 text-muted-foreground" aria-hidden="true" />
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "lastActivity",
      sortDescFirst: true,
      header: ({ column }) => (
        <SortButton<Tenant> column={column} testId={TENANTS_PAGE_HANDLES.SORT_LAST_ACTIVITY}>
          {t("superAdminTenantsView.table.lastActivity")}
        </SortButton>
      ),
      cell: ({ row }) => (
        <LastActivityPreview tenant={row.original} dateTimeFormatter={dateTimeFormatter} t={t} />
      ),
    },
    {
      accessorKey: "activityCountLast14Days",
      sortDescFirst: true,
      header: ({ column }) => (
        <SortButton<Tenant>
          column={column}
          testId={TENANTS_PAGE_HANDLES.SORT_RECENT_ACTIVITY_COUNT}
        >
          <span className="whitespace-pre-line text-left leading-tight">
            {t("superAdminTenantsView.table.activityCountLast14Days")}
          </span>
        </SortButton>
      ),
      cell: ({ row }) => {
        const activityCount = row.original.activityCountLast14Days;
        const activityValue =
          activityCount === 0 ? t("superAdminTenantsView.activityTrend.noActivity") : activityCount;

        return (
          <div
            className="flex items-center gap-2 whitespace-nowrap"
            data-testid={TENANTS_PAGE_HANDLES.activityCount(row.original.id)}
          >
            <span className="font-semibold tabular-nums">{activityValue}</span>
            <ActivityTrend
              percentage={row.original.activityTrendPercentage}
              tenantId={row.original.id}
              t={t}
            />
          </div>
        );
      },
    },
    {
      accessorKey: "activeUsersLast14Days",
      header: () => (
        <span className="whitespace-pre-line leading-tight">
          {t("superAdminTenantsView.table.activeUsersLast14Days")}
        </span>
      ),
      cell: ({ row }) => (
        <span
          className="whitespace-nowrap tabular-nums"
          data-testid={TENANTS_PAGE_HANDLES.activeUsers(row.original.id)}
        >
          {t("superAdminTenantsView.table.activeUsersValue", {
            active: row.original.activeUsersLast14Days,
            total: row.original.totalUsers,
          })}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => (
        <div className="text-right">{t("superAdminTenantsView.table.actions.title")}</div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2 text-right">
          {!row.original.isCurrentTenant && (
            <SupportModePopover
              tenant={row.original}
              isSubmitting={isSupportLoginLoading}
              onProceed={onSupportLogin}
            />
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label={t("superAdminTenantsView.table.actions.title")}
                data-testid={TENANTS_PAGE_HANDLES.actionsMenuButton(row.original.id)}
                size="icon"
                variant="ghost"
              >
                <MoreVertical className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                asChild
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-neutral-900 outline-none focus:bg-accent focus:text-accent-foreground"
              >
                <Link
                  data-testid={TENANTS_PAGE_HANDLES.editButton(row.original.id)}
                  to={`/super-admin/tenants/${row.original.id}`}
                >
                  <Pencil className="size-4 text-neutral-600" aria-hidden="true" />
                  {t("superAdminTenantsView.table.edit")}
                </Link>
              </DropdownMenuItem>
              {!row.original.isCurrentTenant && (
                <DropdownMenuItem
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-error-700 outline-none focus:bg-error-50 focus:text-error-700"
                  data-testid={TENANTS_PAGE_HANDLES.deleteButton(row.original.id)}
                  onSelect={() => onRequestDelete(row.original)}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  {t("superAdminTenantsView.table.delete")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];
};
