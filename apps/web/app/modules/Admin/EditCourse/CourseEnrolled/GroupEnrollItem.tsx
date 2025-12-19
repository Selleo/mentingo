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
        "group rounded-xl flex border bg-white px-4 py-4 gap-4 shadow-sm border-neutral-200 transition-all duration-200 hover:border-neutral-300 hover:shadow-md overflow-visible",
        {
          "bg-neutral-50 border-color-black ring-1 ring-inset ring-color-black/10": selected,
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
                  className="mt-1.5"
                />
              </FormControl>
            </FormItem>
          )}
        />
        <div
          className={cn(
            "flex h-9 w-9 min-w-9 items-center justify-center rounded-lg bg-neutral-100 text-neutral-900 transition-colors",
            {
              "bg-white shadow-sm": selected,
            },
          )}
        >
          <Icon name="Group" className="size-5 text-neutral-900" />
        </div>
      </div>

      <div className="flex flex-col gap-4 w-full">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-color-black text-sm font-semibold whitespace-normal leading-snug">
              <span className="break-all">{name}</span>
            </p>
            {isGroupEnrolled && (
              <Badge
                variant="success"
                icon="InputRoundedMarkerSuccess"
                className="!inline-flex text-xs align-middle max-h-6"
                iconClasses="size-3"
              >
                {t("adminCourseView.enrolled.alreadyEnrolled")}
              </Badge>
            )}
          </div>
          <div className="text-neutral-600 text-sm leading-[150%]">
            {t("adminCourseView.enrolled.members", { count: usersCount })}
          </div>
        </div>
        {selected ? (
          <div className="rounded-xl border border-neutral-200/80 bg-gradient-to-b from-white to-neutral-50 p-4 flex flex-col gap-3 shadow-sm">
            <div
              className={cn("flex items-center justify-between", {
                "pb-3 border-b border-neutral-200/70": obligatory,
              })}
            >
              <div className="flex items-center gap-2">
                <span className="text-color-black text-sm font-medium">
                  {t("adminCourseView.mandatoryCourse")}
                </span>
                <Icon name="Info" className="size-4 text-zest-600" />
              </div>
              <div className="rounded-full bg-white px-1 py-0.5">
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
            </div>

            {obligatory ? (
              <div className="pt-2">
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
                      <label
                        htmlFor={`groups.${index}.deadline`}
                        className="text-color-black text-sm font-medium"
                      >
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
                          className="w-full bg-white"
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
