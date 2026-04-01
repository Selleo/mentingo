import { Check, Minus } from "lucide-react";
import { Fragment, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "~/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  buildPermissionMatrix,
  type PermissionMatrixRole,
} from "~/modules/Admin/Users/utils/permissionsMatrix";

import type { PermissionKey } from "@repo/shared";

type PermissionsMatrixProps = {
  roles: PermissionMatrixRole[];
  permissionsOrder: PermissionKey[];
  title?: string;
  emptyMessage?: string;
  formatPermissionDescription?: (permission: PermissionKey) => string;
  formatGroupLabel?: (group: string) => string;
};

const ACRONYMS: Record<string, string> = {
  ai: "AI",
  api: "API",
  qa: "Q&A",
};

const formatToken = (value: string) => {
  const normalized = value.toLowerCase();

  if (ACRONYMS[normalized]) return ACRONYMS[normalized];

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const toReadable = (value: string) => value.split("_").filter(Boolean).map(formatToken).join(" ");

const PERMISSION_DESCRIPTIONS: Partial<Record<PermissionKey, string>> = {
  "account.read_self": "View their own account details.",
  "account.update_self": "Edit their own account details.",
  "user.read_self": "View their own user profile.",
  "user.manage": "Manage users, including roles and account status.",
  "settings.read_self": "View their own profile and preference settings.",
  "settings.update_self": "Update their own profile and preference settings.",
  "settings.manage": "Manage global platform settings.",
  "env.read_public": "View public environment configuration values.",
  "env.manage": "Manage environment configuration values.",
  "category.read": "View course categories.",
  "category.manage": "Create, edit, and delete course categories.",
  "group.read": "View user groups.",
  "group.manage": "Create, edit, and delete user groups.",
  "course.read_assigned": "View courses assigned to the user.",
  "course.read_manageable": "View courses the user can manage.",
  "course.read": "View course content.",
  "course.create": "Create new courses.",
  "course.update": "Edit any course.",
  "course.update_own": "Edit courses created by the user.",
  "course.delete": "Delete courses.",
  "course.enrollment": "Manage course enrollments.",
  "course.statistics": "View course analytics and statistics.",
  "course.export": "Export course data.",
  "learning_mode.use": "Use learning mode features.",
  "learning_progress.update": "Update learners' progress state.",
  "certificate.read": "View certificates.",
  "certificate.share": "Share certificates.",
  "certificate.render": "Generate certificate files.",
  "file.upload": "Upload files to the platform.",
  "file.delete": "Delete uploaded files.",
  "ai.use": "Use AI-powered platform features.",
  "announcement.read": "View announcements.",
  "announcement.create": "Create announcements.",
  "news.read_public": "View public news posts.",
  "news.manage": "Create, edit, and delete all news posts.",
  "news.manage_own": "Create, edit, and delete own news posts.",
  "article.read_public": "View public knowledge-base articles.",
  "article.manage": "Create, edit, and delete all knowledge-base articles.",
  "article.manage_own": "Create, edit, and delete own knowledge-base articles.",
  "qa.read_public": "View public Q&A entries.",
  "qa.manage": "Create, edit, and delete all Q&A entries.",
  "qa.manage_own": "Create, edit, and delete own Q&A entries.",
  "report.read": "View reports.",
  "statistics.read_self": "View their own statistics.",
  "statistics.read": "View platform-wide statistics.",
  "billing.checkout": "Access billing checkout flows.",
  "billing.manage": "Manage billing settings and subscriptions.",
  "integration_key.manage": "Manage integration API keys.",
  "integration_api.use": "Use integration API endpoints.",
  "tenant.manage": "Manage organization-level configuration.",
  "course.ai_generation": "Generate course structure and content with AI tools.",
};

const defaultPermissionDescriptionFormatter = (permission: PermissionKey) => {
  return PERMISSION_DESCRIPTIONS[permission] ?? "Grants access to this platform capability.";
};

export const PermissionsMatrix = ({
  roles,
  permissionsOrder,
  title,
  emptyMessage,
  formatPermissionDescription,
  formatGroupLabel,
}: PermissionsMatrixProps) => {
  const { t } = useTranslation();
  const rows = useMemo(
    () => buildPermissionMatrix({ roles, permissionsOrder }),
    [permissionsOrder, roles],
  );
  const groupedRows = useMemo(() => {
    const byGroup = rows.reduce<Record<string, typeof rows>>((acc, row) => {
      const [group = "other"] = row.permission.split(".");
      if (!acc[group]) acc[group] = [];
      acc[group].push(row);
      return acc;
    }, {});

    return Object.entries(byGroup).map(([group, items]) => ({ group, items }));
  }, [rows]);

  const getPermissionDescription = (permission: PermissionKey) => {
    if (formatPermissionDescription) return formatPermissionDescription(permission);

    const translationKey = `adminUsersView.permissionsMatrix.descriptions.${permission.replaceAll(".", "_")}`;

    const explicitTranslation = t(translationKey);

    if (explicitTranslation !== translationKey) return explicitTranslation;

    return defaultPermissionDescriptionFormatter(permission);
  };

  const getGroupLabel = (group: string) => {
    if (formatGroupLabel) return formatGroupLabel(group);

    const key = `adminUsersView.permissionsMatrix.resources.${group}`;
    const translated = t(key);

    return translated !== key ? translated : toReadable(group);
  };

  if (!roles.length) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-neutral-600">
        {emptyMessage ?? t("adminUsersView.permissionsMatrix.empty")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {title ? <h3 className="h5 text-neutral-950">{title}</h3> : null}
      <div className="overflow-auto rounded-lg border">
        <Table className="bg-background">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-80">
                {t("adminUsersView.permissionsMatrix.permission")}
              </TableHead>
              {roles.map((role) => (
                <TableHead key={role.slug} className="min-w-32 text-center">
                  <Badge variant="secondary">{role.label}</Badge>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupedRows.map((group) => (
              <Fragment key={group.group}>
                <TableRow className="bg-neutral-300/90 hover:bg-neutral-300/90">
                  <TableCell
                    colSpan={roles.length + 1}
                    className="border-y border-neutral-400 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-800"
                  >
                    {getGroupLabel(group.group)}
                  </TableCell>
                </TableRow>
                {group.items.map((row) => (
                  <TableRow key={row.permission} className="bg-background hover:bg-neutral-50/60">
                    <TableCell className="font-medium text-neutral-800">
                      <p className="text-sm font-normal text-neutral-700">
                        {getPermissionDescription(row.permission)}
                      </p>
                    </TableCell>
                    {roles.map((role) => {
                      const granted = row.grants[role.slug];
                      return (
                        <TableCell key={`${row.permission}-${role.slug}`} className="text-center">
                          {granted ? (
                            <Check className="mx-auto size-4 text-primary-700" />
                          ) : (
                            <Minus className="mx-auto size-4 text-neutral-400" />
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
