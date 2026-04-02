import { Check, Minus } from "lucide-react";
import { Fragment, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "~/components/ui/badge";
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

    return t(translationKey);
  };

  const getGroupLabel = (group: string) => {
    if (formatGroupLabel) return formatGroupLabel(group);

    return t(`adminUsersView.permissionsMatrix.resources.${group}`);
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
      <div className="max-h-[70vh] overflow-auto rounded-lg border">
        <table className="w-full caption-bottom bg-background text-sm">
          <thead className="[&_tr]:border-b">
            <tr className="border-b">
              <th className="sticky top-0 z-30 h-12 min-w-80 bg-background px-4 text-left align-middle font-medium text-muted-foreground">
                {t("adminUsersView.permissionsMatrix.permission")}
              </th>
              {roles.map((role) => (
                <th
                  key={role.slug}
                  className="sticky top-0 z-30 h-12 min-w-32 bg-background px-4 text-left align-middle font-medium text-muted-foreground"
                >
                  <Badge className="grid place-items-center" variant="secondary">
                    {role.label}
                  </Badge>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {groupedRows.map((group) => (
              <Fragment key={group.group}>
                <tr className="border-b bg-neutral-300/90 transition-colors hover:bg-neutral-300/90">
                  <td
                    colSpan={roles.length + 1}
                    className="border-y border-neutral-400 p-4 py-2 align-middle text-xs font-semibold uppercase tracking-wide text-neutral-800"
                  >
                    {getGroupLabel(group.group)}
                  </td>
                </tr>
                {group.items.map((row) => (
                  <tr
                    key={row.permission}
                    className="border-b bg-background transition-colors hover:bg-neutral-50/60"
                  >
                    <td className="p-4 align-middle font-medium text-neutral-800">
                      <p className="text-sm font-normal text-neutral-700">
                        {getPermissionDescription(row.permission)}
                      </p>
                    </td>
                    {roles.map((role) => {
                      const granted = row.grants[role.slug];
                      return (
                        <td
                          key={`${row.permission}-${role.slug}`}
                          className="p-4 text-center align-middle"
                        >
                          {granted ? (
                            <Check className="mx-auto size-4 text-primary-700" />
                          ) : (
                            <Minus className="mx-auto size-4 text-neutral-400" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
