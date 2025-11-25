import { camelCase, capitalize } from "lodash-es";
import { useEffect } from "react";
import { type Control, Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useGroupsQuerySuspense } from "~/api/queries/admin/useGroups";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import MultipleSelector from "~/components/ui/multiselect";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { USER_ROLE } from "~/config/userRoles";
import { useGroupsOptions } from "~/hooks/useGroupsOptions";

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

  const { selectedGroups, setSelectedGroups, filterGroups, options } = useGroupsOptions(groups);

  useEffect(() => {
    if (user.groups) {
      setSelectedGroups(user.groups.map((group) => ({ label: group.name, value: group.id })));
    }
  }, [user, setSelectedGroups]);

  return (
    <Controller
      name={name}
      control={control}
      defaultValue={user[name] as UpdateUserBody[typeof name]}
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

        if (name === "role") {
          return (
            <Select
              onValueChange={field.onChange}
              value={field.value as UpdateUserBody["role"] | undefined}
            >
              <SelectTrigger className="w-full rounded-md border border-neutral-300 px-2 py-1">
                <SelectValue
                  placeholder={capitalize(field.value as string)}
                  className="capitalize"
                />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {[USER_ROLE.student, USER_ROLE.admin, USER_ROLE.contentCreator].map((role) => (
                    <SelectItem className="capitalize" value={role} key={role}>
                      {t(`common.roles.${camelCase(role)}`)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
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
