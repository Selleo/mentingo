import { format } from "date-fns";
import { useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

import { Icon } from "../../../../components/Icon";
import { Badge } from "../../../../components/ui/badge";
import { Checkbox } from "../../../../components/ui/checkbox";
import { FormControl, FormField, FormItem, FormMessage } from "../../../../components/ui/form";
import { Input } from "../../../../components/ui/input";
import { Switch } from "../../../../components/ui/switch";

import type { GroupEnrollFormValues } from "./GroupEnrollModal";

type Props = {
  index: number;
  id: string;
  name: string;
  usersCount: number;
  isGroupEnrolled: boolean;
};

export const GroupEnrollItem = ({ index, id, name, usersCount, isGroupEnrolled }: Props) => {
  const { t } = useTranslation();
  const { control, getValues } = useFormContext<GroupEnrollFormValues>();

  const selected = useWatch({ control, name: `groups.${index}.selected` });
  const obligatory = useWatch({ control, name: `groups.${index}.obligatory` });

  return (
    <div
      className={cn(
        "rounded-lg flex border-2 bg-white px-4 py-3 gap-4 shadow-sm border-neutral-200",
        {
          "bg-neutral-50 border-color-black": selected,
        },
      )}
    >
      <div className="flex gap-4">
        <FormField
          control={control}
          name={`groups.${index}.selected`}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Checkbox
                  checked={!!field.value}
                  onCheckedChange={(currentValue) => field.onChange(Boolean(currentValue))}
                  aria-label={`select-group-${id}`}
                  className="mt-2"
                />
              </FormControl>
            </FormItem>
          )}
        />
        <div className="flex h-9 w-9 min-w-9 items-center justify-center rounded-md bg-neutral-50">
          <Icon name="Group" className="size-5 text-nautral-900" />
        </div>
      </div>

      <div className="flex flex-col gap-4 w-full">
        <div className="flex flex-col">
          <p className="text-color-black text-sm font-medium whitespace-normal">
            <span className="break-all">{name}</span>
            {isGroupEnrolled && (
              <Badge
                variant="success"
                icon="InputRoundedMarkerSuccess"
                className="ml-2 !inline-flex text-xs align-middle max-h-6"
                iconClasses="size-3"
              >
                {t("adminCourseView.enrolled.alreadyEnrolled")}
              </Badge>
            )}
          </p>
          <div className="text-neutral-700 text-base leading-[150%]">
            {t("adminCourseView.enrolled.members", { count: usersCount })}
          </div>
        </div>
        {selected ? (
          <div className="rounded-lg border border-neutral-200 bg-white p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-color-black">{t("adminCourseView.mandatoryCourse")}</span>
                <Icon name="Info" className="size-4 text-zest-600" />
              </div>
              <FormField
                control={control}
                name={`groups.${index}.obligatory`}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Switch
                        checked={!!field.value}
                        onCheckedChange={(val) => field.onChange(Boolean(val))}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {obligatory ? (
              <div>
                <FormField
                  control={control}
                  name={`groups.${index}.deadline`}
                  rules={{
                    validate: (date) => {
                      const isSelectedNow = getValues(`groups.${index}.selected`);
                      const isObligatory = getValues(`groups.${index}.obligatory`);
                      if (!isSelectedNow || !isObligatory) return true;
                      if (!date) return t("adminCourseView.deadlineRequired");

                      return true;
                    },
                  }}
                  render={({ field }) => (
                    <FormItem>
                      <label htmlFor={`groups.${index}.deadline`} className="text-color-black">
                        {t("adminCourseView.deadline")} *
                      </label>
                      <FormControl className="relative">
                        <Input
                          type="date"
                          value={field.value ? format(field.value, "yyyy-MM-dd") : ""}
                          onChange={(e) => {
                            field.onChange(e.target.value);
                          }}
                          placeholder={t("adminCourseView.selectDate")}
                          className="w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};
