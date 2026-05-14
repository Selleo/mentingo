import {
  ArrowRightLeft,
  ArrowRightToLine,
  Bell,
  CheckCircle2,
  CirclePlus,
  LogIn,
  LogOut,
  Pencil,
  Play,
  ShieldAlert,
  Trash2,
  type LucideIcon,
  Users2,
} from "lucide-react";

import type i18next from "i18next";
import type { GetActivityLogsResponse } from "~/api/generated-api";

export type ActivityLogItem = GetActivityLogsResponse["data"][number];
export type ActivityLogActionType = ActivityLogItem["actionType"];

export type ActivityLogActionConfig = {
  icon: LucideIcon;
  badgeClassName: string;
  iconClassName: string;
  ringClassName: string;
};

const defaultActionConfig: ActivityLogActionConfig = {
  icon: Pencil,
  badgeClassName: "border-neutral-200 bg-neutral-50 text-neutral-700",
  iconClassName: "text-blue-700",
  ringClassName: "border-blue-500",
};

export const activityLogActionConfig: Record<ActivityLogActionType, ActivityLogActionConfig> = {
  create: {
    icon: CirclePlus,
    badgeClassName: "border-green-200 bg-green-50 text-green-700",
    iconClassName: "text-green-700",
    ringClassName: "border-green-600",
  },
  update: {
    icon: Pencil,
    badgeClassName: "border-blue-200 bg-blue-50 text-blue-700",
    iconClassName: "text-blue-700",
    ringClassName: "border-blue-600",
  },
  delete: {
    icon: Trash2,
    badgeClassName: "border-red-200 bg-red-50 text-red-700",
    iconClassName: "text-red-700",
    ringClassName: "border-red-600",
  },
  login: {
    icon: LogIn,
    badgeClassName: "border-violet-200 bg-violet-50 text-violet-700",
    iconClassName: "text-violet-700",
    ringClassName: "border-violet-600",
  },
  login_failed: {
    icon: ShieldAlert,
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-800",
    iconClassName: "text-amber-700",
    ringClassName: "border-amber-600",
  },
  logout: {
    icon: LogOut,
    badgeClassName: "border-pink-200 bg-pink-50 text-pink-700",
    iconClassName: "text-pink-700",
    ringClassName: "border-pink-600",
  },
  enroll_course: {
    icon: ArrowRightToLine,
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
    iconClassName: "text-emerald-700",
    ringClassName: "border-emerald-600",
  },
  unenroll_course: {
    icon: ArrowRightLeft,
    badgeClassName: "border-orange-200 bg-orange-50 text-orange-700",
    iconClassName: "text-orange-700",
    ringClassName: "border-orange-600",
  },
  start_course: {
    icon: Play,
    badgeClassName: "border-sky-200 bg-sky-50 text-sky-700",
    iconClassName: "text-sky-700",
    ringClassName: "border-sky-600",
  },
  group_assignment: {
    icon: Users2,
    badgeClassName: "border-indigo-200 bg-indigo-50 text-indigo-700",
    iconClassName: "text-indigo-700",
    ringClassName: "border-indigo-600",
  },
  complete_lesson: {
    icon: CheckCircle2,
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
    iconClassName: "text-emerald-700",
    ringClassName: "border-emerald-600",
  },
  complete_course: {
    icon: CheckCircle2,
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
    iconClassName: "text-emerald-700",
    ringClassName: "border-emerald-600",
  },
  complete_chapter: {
    icon: CheckCircle2,
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
    iconClassName: "text-emerald-700",
    ringClassName: "border-emerald-600",
  },
  view_announcement: {
    icon: Bell,
    badgeClassName: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
    iconClassName: "text-fuchsia-700",
    ringClassName: "border-fuchsia-600",
  },
};

export const getActivityLogActionConfig = (actionType: ActivityLogActionType) =>
  activityLogActionConfig[actionType] ?? defaultActionConfig;

export const getActivityLogActionLabel = (
  t: typeof i18next.t,
  actionType: ActivityLogActionType | string | null,
) => {
  if (!actionType) return t("activityLogsView.fallbacks.unknown");

  return t(`activityLogsView.actions.${actionType}`, { defaultValue: actionType });
};

export const getActivityLogEntityLabel = (t: typeof i18next.t, resourceType: string | null) => {
  if (!resourceType) return t("activityLogsView.fallbacks.unknown");

  return t(`activityLogsView.entity.${resourceType}`, { defaultValue: resourceType });
};

export type ActivityLogDetailSection = {
  key: "before" | "after" | "context";
  value: unknown;
};

export type ActivityLogMetadataPayload = {
  before?: unknown | null;
  after?: unknown | null;
  context?: unknown | null;
  operation?: string | null;
  changedFields?: unknown[] | null;
};

const activityLogDetailKeys = ["before", "after", "context"] as const;

export const getActivityLogDetailSections = (
  metadata: ActivityLogMetadataPayload | null | undefined,
  actionType?: ActivityLogActionType | string | null,
): ActivityLogDetailSection[] => {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }

  const keys: ActivityLogDetailSection["key"][] =
    actionType === "update" ? ["before", "after"] : [...activityLogDetailKeys];

  return keys.flatMap((key) => {
    const value = metadata[key as keyof ActivityLogMetadataPayload];

    if (value === null || value === undefined) {
      return [];
    }

    return [{ key, value }];
  });
};
