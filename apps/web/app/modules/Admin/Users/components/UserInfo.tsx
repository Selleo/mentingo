import { useEffect } from "react";
import { type Control, Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useGroupsQuerySuspense } from "~/api/queries/admin/useGroups";
import { useRoles } from "~/api/queries/admin/useRoles";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import MultipleSelector from "~/components/ui/multiselect";
import { useGroupsOptions } from "~/hooks/useGroupsOptions";
import { getRoleLabel } from "~/modules/Admin/Users/utils/getRoleLabel";

import type { GetUserByIdResponse, UpdateUserBody } from "~/api/generated-api";

interface UserInfoType {
  name: keyof UpdateUserBody;
  control: Control<UpdateUserBody>;
  isEditing: boolean;
  user: GetUserByIdResponse["data"];
}

export const UserInfo = ({ name, control, isEditing, user }: UserInfoType) => {
  const { t } = useTranslation();
  const { data: groups } = useGroupsQuerySuspense();
  const { data: roles = [] } = useRoles();

  const { selectedGroups, setSelectedGroups, filterGroups, options } = useGroupsOptions(groups);

  useEffect(() => {
    if (user.groups) {
      setSelectedGroups(user.groups.map((group) => ({ label: group.name, value: group.id })));
    }
  }, [user, setSelectedGroups]);

  const defaultValue: UpdateUserBody[typeof name] =
    name === "groups"
      ? (user.groups.map((group) => group.id) as UpdateUserBody[typeof name])
      : (user[name] as UpdateUserBody[typeof name]);

  return (
    <Controller
      name={name}
      control={control}
      defaultValue={defaultValue}
      render={({ field }) => {
        if (!isEditing) {
          if (name === "archived") {
            return (
              <span className="font-semibold capitalize">
                {user[name] ? t("common.other.archived") : t("common.other.active")}
              </span>
            );
          }
          return <span className="font-semibold capitalize">{user[name]?.toString()}</span>;
        }

        if (name === "roleSlugs") {
          return (
            <MultipleSelector
              value={((field.value as string[] | undefined) ?? []).map((roleSlug) => ({
                value: roleSlug,
                label: getRoleLabel(roleSlug, t, roles),
              }))}
              options={roles.map((role) => ({
                value: role.slug,
                label: getRoleLabel(role.slug, t, roles),
              }))}
              onChange={(options) => field.onChange(options.map((option) => option.value))}
              placeholder={t("adminUsersView.filters.placeholder.roles")}
              hidePlaceholderWhenSelected
              hideClearAllButton
              className="w-full bg-background p-2"
              badgeClassName="bg-accent text-accent-foreground text-sm hover:bg-accent"
              commandProps={{
                label: t("adminUsersView.filters.placeholder.roles"),
              }}
              inputProps={{
                className: "w-full outline-none py-0 body-base",
              }}
              checkbox={false}
            />
          );
        }

        if (name === "groups") {
          return (
            <MultipleSelector
              commandProps={{
                label: t("adminGroupsView.groupSelect.label"),
                filter: filterGroups,
              }}
              data-testid="groupSelect"
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
          );
        }

        if (name === "archived") {
          return (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="archived"
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
            value={field.value as string}
            type={name === "email" ? "email" : "text"}
            className="w-full rounded-md border border-neutral-300 px-2 py-1"
          />
        );
      }}
    />
  );
};
