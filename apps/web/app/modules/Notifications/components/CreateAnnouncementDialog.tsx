import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useCreateAnnouncement } from "~/api/mutations/admin/useCreateAnnouncement";
import { useGroupsQuery } from "~/api/queries/admin/useGroups";
import { Icon } from "~/components/Icon";
import { languageOptions } from "~/components/LanguageSelector/languageOptions";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import { CalendarDateTimeField } from "~/modules/Calendar/components/CalendarDateTimeField";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { EVERYONE_GROUP_VALUE } from "../constants";
import { NOTIFICATIONS_HANDLES } from "../handles";
import { createAnnouncementFormSchema } from "../schemas/createAnnouncement.schema";
import { buildAnnouncementScheduledAt, getDefaultAnnouncementFormValues } from "../utils";

import type { CreateAnnouncementDialogProps, TranslationFormValues } from "../types";
import type { SupportedLanguages } from "@repo/shared";
import type { FieldErrors } from "react-hook-form";
import type { CreateAnnouncementBody } from "~/api/generated-api";

export function CreateAnnouncementDialog({ open, onOpenChange }: CreateAnnouncementDialogProps) {
  const { t } = useTranslation();

  const appLanguage = useLanguageStore((state) => state.language);

  const { data: groups = [] } = useGroupsQuery({ language: appLanguage }, { enabled: open });

  const { mutateAsync: createAnnouncement, isPending } = useCreateAnnouncement();

  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguages>(appLanguage);
  const [enabledLanguages, setEnabledLanguages] = useState<SupportedLanguages[]>([appLanguage]);

  const formSchema = useMemo(
    () => createAnnouncementFormSchema(enabledLanguages, t),
    [enabledLanguages, t],
  );

  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setValue,
    clearErrors,
    control,
  } = useForm<TranslationFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: getDefaultAnnouncementFormValues(),
    mode: "onSubmit",
  });

  const baseLanguage = enabledLanguages[0] ?? selectedLanguage;
  const isSelectedEnabled = enabledLanguages.includes(selectedLanguage);
  const groupId = useWatch({ control, name: "groupId" });
  const activeTranslation = useWatch({ control, name: `translations.${selectedLanguage}` });
  const scheduled = useWatch({ control, name: "scheduled" });
  const scheduledDate = useWatch({ control, name: "scheduledDate" });
  const scheduledTime = useWatch({ control, name: "scheduledTime" });
  const sendEmail = useWatch({ control, name: "sendEmail" });
  const selectedLanguageErrors = errors.translations?.[selectedLanguage];
  const addedLanguageItems = languageOptions.filter((item) => enabledLanguages.includes(item.key));
  const notAddedLanguageItems = languageOptions.filter(
    (item) => !enabledLanguages.includes(item.key),
  );

  const resetForm = () => {
    setSelectedLanguage(appLanguage);
    setEnabledLanguages([appLanguage]);
    reset(getDefaultAnnouncementFormValues());
  };

  const handleLanguageChange = (language: SupportedLanguages) => {
    setSelectedLanguage(language);
    setEnabledLanguages((current) => {
      if (current.includes(language)) return current;
      return [...current, language];
    });
  };

  const removeSelectedLanguage = () => {
    setEnabledLanguages((current) => {
      const nextLanguages = current.filter((language) => language !== selectedLanguage);
      const nextSelected = nextLanguages[0] ?? appLanguage;

      clearErrors(`translations.${selectedLanguage}`);
      setSelectedLanguage(nextSelected);
      return nextLanguages.length ? nextLanguages : [appLanguage];
    });
  };

  const setSelectedLanguageAsDefault = () => {
    setEnabledLanguages((current) => [
      selectedLanguage,
      ...current.filter((language) => language !== selectedLanguage),
    ]);
  };

  const onSubmit = async (values: TranslationFormValues) => {
    const data: CreateAnnouncementBody = {
      groupId: values.groupId,
      baseLanguage,
      translations: enabledLanguages.map((language) => ({
        language,
        title: values.translations[language].title.trim(),
        content: values.translations[language].content.trim(),
      })),
      scheduledAt: values.scheduled
        ? buildAnnouncementScheduledAt(values.scheduledDate, values.scheduledTime)
        : null,
      sendEmail: values.sendEmail,
    };

    await createAnnouncement({ data });

    resetForm();
    onOpenChange(false);
  };

  const onInvalid = (formErrors: FieldErrors<TranslationFormValues>) => {
    const failedLanguage = enabledLanguages.find((language) => formErrors.translations?.[language]);
    if (failedLanguage) setSelectedLanguage(failedLanguage);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"
        data-testid={NOTIFICATIONS_HANDLES.CREATE_DIALOG}
      >
        <DialogHeader>
          <DialogTitle>{t("announcements.createPage.header")}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-5">
          <div className="grid gap-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-48 flex-1 space-y-2">
                <Label>{t("announcements.createPage.fields.language")}</Label>
                <Select
                  value={selectedLanguage}
                  onValueChange={(value: SupportedLanguages) => handleLanguageChange(value)}
                >
                  <SelectTrigger
                    className="min-w-[200px]"
                    data-testid={NOTIFICATIONS_HANDLES.CREATE_LANGUAGE_SELECT}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {addedLanguageItems.map((item) => (
                      <SelectItem
                        key={item.key}
                        value={item.key}
                        className="w-full"
                        data-testid={NOTIFICATIONS_HANDLES.languageOption(item.key)}
                      >
                        <div className="flex w-full items-center gap-2">
                          <Icon name={item.iconName} className="size-4" />
                          <span className="font-semibold">{t(item.translationKey)}</span>
                          {baseLanguage === item.key && (
                            <span className="rounded bg-neutral-200 px-2 text-[11px] font-medium text-neutral-700">
                              {t("adminCourseView.common.baseLanguage")}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}

                    {notAddedLanguageItems.length > 0 && (
                      <>
                        <Separator className="my-1" />
                        <div className="px-2 py-1 text-xs uppercase text-neutral-500">
                          {t("adminCourseView.common.notAddedLanguages")}
                        </div>
                        {notAddedLanguageItems.map((item) => (
                          <SelectItem
                            key={item.key}
                            value={item.key}
                            data-testid={NOTIFICATIONS_HANDLES.languageOption(item.key)}
                          >
                            <div className="flex w-full items-center gap-2">
                              <Icon name={item.iconName} className="size-4" />
                              <span className="font-semibold">{t(item.translationKey)}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {isSelectedEnabled && enabledLanguages.length > 1 && (
                <>
                  {selectedLanguage !== baseLanguage && (
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0"
                      onClick={setSelectedLanguageAsDefault}
                    >
                      {t("announcements.createPage.buttons.setDefaultLanguage")}
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0 rounded-lg p-1"
                    onClick={removeSelectedLanguage}
                  >
                    <Icon name="TrashIcon" className="size-5" />
                    <span className="sr-only">
                      {t("announcements.createPage.buttons.removeLanguage")}
                    </span>
                  </Button>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-700">
              <span className="font-medium">{t("announcements.createPage.addedLanguages")}:</span>
              {addedLanguageItems.map((item) => (
                <Badge
                  key={item.key}
                  title={t(item.translationKey)}
                  variant="secondaryWithOutline"
                  fontWeight="bold"
                  className={cn(
                    "h-8 gap-1.5 rounded-lg px-2 py-1",
                    item.key === baseLanguage && "border-primary-500 bg-primary-50",
                  )}
                >
                  <Icon name={item.iconName} className="size-4" />
                  {item.key === baseLanguage && (
                    <span className="rounded bg-neutral-200 px-2 text-[11px] font-medium text-neutral-700">
                      {t("adminCourseView.common.baseLanguage")}
                    </span>
                  )}
                  <span className="sr-only">{t(item.translationKey)}</span>
                </Badge>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="announcement-title">
                {t("announcements.createPage.fields.title")}
              </Label>
              <Input
                id="announcement-title"
                value={activeTranslation?.title ?? ""}
                placeholder={t("announcements.createPage.placeholders.title")}
                data-testid={NOTIFICATIONS_HANDLES.CREATE_TITLE_INPUT}
                {...register(`translations.${selectedLanguage}.title`)}
              />
              {selectedLanguageErrors?.title && (
                <p className="text-sm text-error-600">{selectedLanguageErrors.title.message}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="announcement-content">
                {t("announcements.createPage.fields.content")}
              </Label>
              <Textarea
                id="announcement-content"
                className="min-h-44"
                value={activeTranslation?.content ?? ""}
                placeholder={t("announcements.createPage.placeholders.content")}
                data-testid={NOTIFICATIONS_HANDLES.CREATE_CONTENT_INPUT}
                {...register(`translations.${selectedLanguage}.content`)}
              />
              {selectedLanguageErrors?.content && (
                <p className="text-sm text-error-600">{selectedLanguageErrors.content.message}</p>
              )}
            </div>
          </div>

          <div className="grid gap-2">
            <Label>{t("announcements.createPage.fields.group")}</Label>
            <Select
              value={groupId ?? EVERYONE_GROUP_VALUE}
              onValueChange={(value) => {
                setValue("groupId", value === EVERYONE_GROUP_VALUE ? null : value, {
                  shouldDirty: true,
                });
              }}
            >
              <SelectTrigger data-testid={NOTIFICATIONS_HANDLES.CREATE_GROUP_SELECT}>
                <SelectValue placeholder={t("announcements.createPage.placeholders.group")} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem
                    value={EVERYONE_GROUP_VALUE}
                    data-testid={NOTIFICATIONS_HANDLES.groupOption(EVERYONE_GROUP_VALUE)}
                  >
                    {t("announcements.createPage.fields.everyone")}
                  </SelectItem>
                  {groups.map((group) => (
                    <SelectItem
                      key={group.id}
                      value={group.id}
                      data-testid={NOTIFICATIONS_HANDLES.groupOption(group.id)}
                    >
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="grid gap-4">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 p-3">
              <div className="space-y-1">
                <Label>{t("announcements.createPage.fields.schedule")}</Label>
                <p className="text-sm text-neutral-600">
                  {t("announcements.createPage.descriptions.schedule")}
                </p>
              </div>
              <Switch
                checked={scheduled}
                onCheckedChange={(checked) => setValue("scheduled", checked, { shouldDirty: true })}
              />
            </div>

            {scheduled && (
              <div className="grid gap-2">
                <CalendarDateTimeField
                  label={t("announcements.createPage.fields.scheduledAt")}
                  tooltip={t("announcements.createPage.tooltips.scheduledAt")}
                  date={scheduledDate}
                  time={scheduledTime}
                  timeStepMinutes={5}
                  portalledDatePicker={false}
                  onDateChange={(date) =>
                    setValue("scheduledDate", date, { shouldDirty: true, shouldValidate: true })
                  }
                  onTimeChange={(time) =>
                    setValue("scheduledTime", time, { shouldDirty: true, shouldValidate: true })
                  }
                />
                {(errors.scheduledDate || errors.scheduledTime) && (
                  <p className="text-sm text-error-600">
                    {errors.scheduledDate?.message ?? errors.scheduledTime?.message}
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 p-3">
              <div className="space-y-1">
                <Label>{t("announcements.createPage.fields.sendEmail")}</Label>
                <p className="text-sm text-neutral-600">
                  {t("announcements.createPage.descriptions.sendEmail")}
                </p>
              </div>
              <Switch
                checked={sendEmail}
                onCheckedChange={(checked) => setValue("sendEmail", checked, { shouldDirty: true })}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.button.cancel")}
          </Button>
          <Button
            type="button"
            disabled={isPending}
            onClick={handleSubmit(onSubmit, onInvalid)}
            data-testid={NOTIFICATIONS_HANDLES.CREATE_SUBMIT_BUTTON}
          >
            {isPending ? t("common.button.saving") : t("common.button.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
