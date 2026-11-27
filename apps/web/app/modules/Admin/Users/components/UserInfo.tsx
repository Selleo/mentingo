import { useEffect } from "react";
import { type Control, Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useRestoreDirectoryRoles } from "~/api/mutations/admin/useRestoreDirectoryRoles";
import { useGroupsQuerySuspense } from "~/api/queries/admin/useGroups";
import { useRoles } from "~/api/queries/admin/useRoles";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import MultipleSelector from "~/components/ui/multiselect";
import { useGroupsOptions } from "~/hooks/useGroupsOptions";
import { getRoleLabel } from "~/modules/Admin/Users/utils/getRoleLabel";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { getUserFieldMaxLength } from "~/utils/getUserFieldMaxLength";

import { USER_PAGE_HANDLES } from "../../../../../e2e/data/users/handles";

import { UserMultiSelect } from "./UserMultiSelect";

import type { GetUserByIdResponse, UpdateUserBody } from "~/api/generated-api";

interface UserInfoType {
  name: keyof UpdateUserBody;
  control: Control<UpdateUserBody>;
  isEditing: boolean;
  user: GetUserByIdResponse["data"];
}

export const UserInfo = ({ name, control, isEditing, user }: UserInfoType) => {
  const { t } = useTranslation();

  const language = useLanguageStore((state) => state.language);

  const { data: groups } = useGroupsQuerySuspense({ language });
  const { data: roles = [] } = useRoles();

  const { selectedGroups, setSelectedGroups, filterGroups, options } = useGroupsOptions(groups);

  useEffect(() => {
    if (user.groups) {
      setSelectedGroups(user.groups.map((group) => ({ label: group.name, value: group.id })));
    }
  }, [user, setSelectedGroups]);

  const getDefaultValue = (): UpdateUserBody[typeof name] => {
    switch (name) {
      case "firstName":
        return user.firstName;
      case "lastName":
        return user.lastName;
      case "email":
        return user.email;
      case "roleSlugs":
        return user.roleSlugs;
      case "groups":
        return user.groups.map((group) => group.id);
      case "managedGroupIds":
        return (user.managedGroups ?? []).map((group) => group.id);
      case "archived":
        return user.archived;
    }
  };

  const getDisplayValue = () => {
    switch (name) {
      case "groups":
        return user.groups.map((group) => group.name).join(", ");
      case "managedGroupIds":
        return (user.managedGroups ?? []).map((group) => group.name).join(", ");
      case "roleSlugs":
        return user.roleSlugs.join(", ");
      case "firstName":
        return user.firstName;
      case "lastName":
        return user.lastName;
      case "email":
        return user.email;
      case "archived":
        return user.archived.toString();
    }
  };

  const getInputTestId = () => {
    switch (name) {
      case "firstName":
        return USER_PAGE_HANDLES.FIRST_NAME_INPUT;
      case "lastName":
        return USER_PAGE_HANDLES.LAST_NAME_INPUT;
      case "email":
        return USER_PAGE_HANDLES.EMAIL_INPUT;
      default:
        return undefined;
    }
  };

  return (
    <Controller
      name={name}
      control={control}
      defaultValue={getDefaultValue()}
      render={({ field }) => {
        if (!isEditing) {
          if (name === "archived") {
            return (
              <span className="font-semibold capitalize">
                {user[name] ? t("common.other.archived") : t("common.other.active")}
              </span>
            );
          }
          return <span className="font-semibold capitalize">{getDisplayValue()}</span>;
        }

        if (name === "roleSlugs") {
          return (
            <div className="space-y-1">
              <UserMultiSelect
                testId={USER_PAGE_HANDLES.ROLE_SELECT}
                getOptionTestId={(option) => USER_PAGE_HANDLES.roleOption(option.value)}
                value={(field.value as string[] | undefined) ?? []}
                options={roles.map((role) => ({
                  value: role.slug,
                  label: getRoleLabel(role.slug, t, roles),
                }))}
                onChange={field.onChange}
                placeholder={t("adminUsersView.filters.placeholder.roles")}
              />
              {user.isDirectoryManaged && <DirectoryRoleNotice user={user} />}
            </div>
          );
        }

        if (name === "groups") {
          return (
            <div className="space-y-1">
              <MultipleSelector
                testId={USER_PAGE_HANDLES.GROUPS_SELECT}
                getOptionTestId={(option) => USER_PAGE_HANDLES.groupOption(option.value)}
                commandProps={{
                  label: t("adminGroupsView.groupSelect.label"),
                  filter: filterGroups,
                }}
                onChange={(options) => {
                  setSelectedGroups(options);
                  field.onChange(options.map((option) => option.value));
                }}
                value={selectedGroups}
                defaultOptions={options}
                placeholder={t("adminGroupsView.groupSelect.label")}
                hideClearAllButton
                hidePlaceholderWhenSelected
                emptyIndicator={<p>{t("adminGroupsView.groupSelect.noGroups")}</p>}
                className="w-full bg-background p-2"
                badgeClassName="bg-accent text-accent-foreground text-sm hover:bg-accent"
                inputProps={{
                  className: "w-full outline-none py-0 body-base",
                }}
                checkbox={false}
              />
              {user.isDirectoryManaged && (
                <p className="body-sm text-neutral-600">
                  {t("directorySync.user.groupsManagedByDirectory")}
                </p>
              )}
            </div>
          );
        }

        if (name === "managedGroupIds") {
          return (
            <UserMultiSelect
              testId={USER_PAGE_HANDLES.MANAGED_GROUPS_SELECT}
              getOptionTestId={(option) => USER_PAGE_HANDLES.managedGroupOption(option.value)}
              value={(field.value as string[] | undefined) ?? []}
              options={groups.map((group) => ({ value: group.id, label: group.name }))}
              onChange={field.onChange}
              placeholder={t("adminUserView.placeholder.managedGroups")}
              emptyIndicator={<p>{t("adminGroupsView.groupSelect.noGroups")}</p>}
            />
          );
        }

        if (name === "archived") {
          return (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="archived"
                data-testid={USER_PAGE_HANDLES.ARCHIVED_CHECKBOX}
                checked={field.value as boolean | undefined}
                onCheckedChange={(checked) => field.onChange(checked)}
              />
              <label
                htmlFor="archived"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {t("common.other.archived")}
              </label>
            </div>
          );
        }

        return (
          <Input
            {...field}
            maxLength={getUserFieldMaxLength(name)}
            data-testid={getInputTestId()}
            value={field.value as string}
            type={name === "email" ? "email" : "text"}
            className="w-full rounded-md border border-neutral-300 px-2 py-1"
          />
        );
      }}
    />
  );
};

function DirectoryRoleNotice({ user }: { user: GetUserByIdResponse["data"] }) {
  const { t } = useTranslation();
  const { mutateAsync: restoreDirectoryRoles, isPending } = useRestoreDirectoryRoles();

  if (!user.isRoleOverridden) {
    return (
      <p className="body-sm text-neutral-600">{t("directorySync.user.rolesOverrideNotice")}</p>
    );
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      data-testid={USER_PAGE_HANDLES.ROLES_OVERRIDDEN_NOTICE}
    >
      <p className="body-sm text-neutral-600">{t("directorySync.user.rolesOverridden")}</p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() => restoreDirectoryRoles(user.id)}
        data-testid={USER_PAGE_HANDLES.RESTORE_DIRECTORY_ROLES_BUTTON}
      >
        {t("directorySync.user.restoreDirectoryRoles")}
      </Button>
    </div>
  );
}
