import { camelCase, capitalize } from "lodash-es";
import { memo } from "react";
import { type Control, Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useGroupsQuerySuspense } from "~/api/queries/admin/useGroups";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { USER_ROLE } from "~/config/userRoles";

import type { GetUserByIdResponse, UpdateUserBody } from "~/api/generated-api";

export const UserInfo = memo<{
  name: keyof UpdateUserBody;
  control: Control<UpdateUserBody>;
  isEditing: boolean;
  user: GetUserByIdResponse["data"];
}>(({ name, control, isEditing, user }) => {
  const { t } = useTranslation();
  const { data: groups } = useGroupsQuerySuspense();

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

        if (name === "groupId") {
          return (
            <Select
              onValueChange={field.onChange}
              value={(field.value as UpdateUserBody["groupId"]) || undefined}
            >
              <SelectTrigger
                className="w-full rounded-md border border-neutral-300 px-2 py-1"
                data-testid="groupSelect"
              >
                <SelectValue
                  placeholder={capitalize(field.value as string)}
                  className="capitalize"
                  data-testid="selectValue"
                />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {groups.map((group) => (
                    <SelectItem className="capitalize" value={group.id} key={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
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
});
