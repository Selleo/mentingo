import * as PopoverPrimitive from "@radix-ui/react-popover";
import { format, isValid, parseISO } from "date-fns";
import { enUS, pl } from "date-fns/locale";
import { useMemo, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { cn } from "~/lib/utils";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { Icon } from "../../../../components/Icon";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { Calendar } from "../../../../components/ui/calendar";
import { Checkbox } from "../../../../components/ui/checkbox";
import { FormControl, FormField, FormItem, FormMessage } from "../../../../components/ui/form";
import { Switch } from "../../../../components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../../../components/ui/tooltip";

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

  const language = useLanguageStore((state) => state.language);

  const selected = useWatch({ control, name: `groups.${index}.selected` });
  const obligatory = useWatch({ control, name: `groups.${index}.obligatory` });

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const { showMandatorySection } = useMemo(() => {
    const showMandatory = selected || obligatory;
    return { showMandatorySection: showMandatory };
  }, [selected, obligatory]);

  const { currentYear, calendarLocale } = useMemo(() => {
    const year = new Date().getFullYear();

    const locale = match(language)
      .with("pl", () => pl)
      .otherwise(() => enUS);

    return { currentYear: year, calendarLocale: locale };
  }, [language]);

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
                  disabled={isGroupEnrolled}
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
        {showMandatorySection ? (
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
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <Icon name="Info" className="size-4 text-zest-600" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      {t("adminCourseView.mandatoryCourseTooltip")}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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
                          disabled={isGroupEnrolled}
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
                        <PopoverPrimitive.Root
                          open={isCalendarOpen}
                          onOpenChange={setIsCalendarOpen}
                        >
                          <PopoverPrimitive.Trigger asChild>
                            <Button
                              id={`groups.${index}.deadline`}
                              type="button"
                              variant="outline"
                              className={cn(
                                "w-full flex items-center gap-3 font-normal bg-white shadow-sm border-neutral-200",
                                field.value && isValid(parseISO(field.value))
                                  ? "text-neutral-900 hover:text-neutral-900"
                                  : "text-neutral-500 hover:text-neutral-500",
                              )}
                              onClick={() => setIsCalendarOpen(true)}
                              disabled={isGroupEnrolled}
                            >
                              <Icon name="Calendar" className="size-4 text-neutral-500" />
                              <span className="grow text-left">
                                {field.value && isValid(parseISO(field.value))
                                  ? format(parseISO(field.value), "PPP", {
                                      locale: calendarLocale,
                                    })
                                  : t("adminCourseView.selectDate")}
                              </span>
                            </Button>
                          </PopoverPrimitive.Trigger>
                          <PopoverPrimitive.Content
                            align="start"
                            sideOffset={4}
                            className={cn(
                              "z-50 w-auto rounded-lg border bg-popover p-2 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
                            )}
                          >
                            <Calendar
                              variant="default"
                              mode="single"
                              captionLayout="dropdown-buttons"
                              selected={
                                field.value && isValid(parseISO(field.value))
                                  ? parseISO(field.value)
                                  : undefined
                              }
                              onSelect={(date) => {
                                if (!date) {
                                  field.onChange("");
                                  return;
                                }

                                field.onChange(format(date, "yyyy-MM-dd"));
                                setIsCalendarOpen(false);
                              }}
                              initialFocus
                              weekStartsOn={1}
                              fromYear={currentYear}
                              toYear={currentYear + 15}
                              locale={calendarLocale}
                            />
                          </PopoverPrimitive.Content>
                        </PopoverPrimitive.Root>
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
