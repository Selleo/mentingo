import {
  LIVE_TRAINING_DELIVERY_TYPES,
  LIVE_TRAINING_DESCRIPTION_MAX_LENGTH,
  LIVE_TRAINING_MAX_PARTICIPANTS_LIMIT,
  LIVE_TRAINING_TITLE_MAX_LENGTH,
} from "@repo/shared";
import { CalendarPlus, Mic, Video } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCreateLiveTraining } from "~/api/mutations/live-training/useCreateLiveTraining";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { TooltipProvider } from "~/components/ui/tooltip";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { CALENDAR_CREATE_MODES } from "./calendarCreateLiveTraining.constants";
import { getCalendarCreateLiveTrainingSchema } from "./calendarCreateLiveTraining.schema";
import {
  buildCalendarCreateAllDayEndDateTime,
  buildCalendarCreateAllDayStartDateTime,
  buildCalendarCreateDateTime,
  buildInitialCalendarCreateLiveTrainingFormState,
} from "./calendarCreateLiveTraining.utils";
import { CalendarDateTimeField } from "./CalendarDateTimeField";
import { CalendarFormFieldLabel } from "./CalendarFormFieldLabel";
import { CalendarViewerPermissionToggle } from "./CalendarViewerPermissionToggle";

import type {
  CalendarCreateLiveTrainingDialogProps,
  CalendarCreateLiveTrainingFormState,
  CalendarCreateMode,
} from "./calendarCreateLiveTraining.types";
import type { FormEvent } from "react";
import type { CreateLiveTrainingBody } from "~/api/generated-api";

type CalendarCreateSectionProps = {
  title: string;
  children: React.ReactNode;
};

function CalendarCreateSection({ title, children }: CalendarCreateSectionProps) {
  return (
    <section className="grid gap-4 border-t border-neutral-200 py-5 first:border-t-0 first:pt-0 last:pb-0">
      <h3 className="text-xs font-semibold uppercase text-neutral-500">{title}</h3>
      {children}
    </section>
  );
}

export function CalendarCreateLiveTrainingDialog({
  open,
  selectedRange,
  timezone,
  canCreateLiveTraining,
  onOpenChange,
}: CalendarCreateLiveTrainingDialogProps) {
  const { t } = useTranslation();
  const appLanguage = useLanguageStore((state) => state.language);
  const { mutateAsync: createLiveTraining, isPending } = useCreateLiveTraining();

  const initialFormState = useMemo(
    () => buildInitialCalendarCreateLiveTrainingFormState(selectedRange),
    [selectedRange],
  );

  const [mode, setMode] = useState<CalendarCreateMode>(CALENDAR_CREATE_MODES.MENU);
  const [formState, setFormState] = useState<CalendarCreateLiveTrainingFormState>(initialFormState);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setMode(CALENDAR_CREATE_MODES.MENU);
    setFormState(initialFormState);
    setFormError(null);
  }, [initialFormState, open]);

  const handleClose = (isOpen: boolean) => {
    if (isPending) return;
    onOpenChange(isOpen);
  };

  const updateFormState = <Key extends keyof CalendarCreateLiveTrainingFormState>(
    key: Key,
    value: CalendarCreateLiveTrainingFormState[Key],
  ) => {
    setFormState((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const startsAt = formState.allDay
      ? buildCalendarCreateAllDayStartDateTime(formState.startDate)
      : buildCalendarCreateDateTime(formState.startDate, formState.startTime);
    const endsAt = formState.allDay
      ? buildCalendarCreateAllDayEndDateTime(formState.endDate)
      : buildCalendarCreateDateTime(formState.endDate, formState.endTime);

    const validationResult = getCalendarCreateLiveTrainingSchema(t).safeParse({
      title: formState.title,
      startsAt,
      endsAt,
    });

    if (!validationResult.success) {
      setFormError(
        validationResult.error.issues[0]?.message ?? t("common.toast.somethingWentWrong"),
      );
      return;
    }

    setFormError(null);

    const payload: CreateLiveTrainingBody = {
      title: formState.title.trim(),
      description: formState.description.trim() || null,
      language: appLanguage,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      allDay: formState.allDay,
      timezone,
      deliveryType: formState.deliveryType,
      location:
        formState.deliveryType === LIVE_TRAINING_DELIVERY_TYPES.OFFLINE && formState.location.trim()
          ? formState.location.trim()
          : null,
      maxParticipants: formState.maxParticipants,
      settings: {
        viewerPermissions: {
          microphoneEnabled: formState.microphoneEnabled,
          cameraEnabled: formState.cameraEnabled,
        },
      },
    };

    await createLiveTraining(payload);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[92dvh] flex-col overflow-hidden p-0 sm:max-w-[720px]">
        <DialogHeader>
          <div className="px-6 pt-6">
            <DialogTitle>{t("calendarView.create.title")}</DialogTitle>
            <DialogDescription>{t("calendarView.create.description")}</DialogDescription>
          </div>
        </DialogHeader>

        {mode === CALENDAR_CREATE_MODES.MENU && (
          <div className="grid gap-3 px-6 pb-6">
            {canCreateLiveTraining ? (
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg border border-neutral-200 bg-white p-4 text-left transition-colors hover:border-primary-300 hover:bg-primary-50"
                onClick={() => setMode(CALENDAR_CREATE_MODES.LIVE_TRAINING)}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                  <CalendarPlus className="size-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-neutral-950">
                    {t("calendarView.create.liveTrainingOption.title")}
                  </span>
                  <span className="mt-1 block text-sm text-neutral-600">
                    {t("calendarView.create.liveTrainingOption.description")}
                  </span>
                </span>
              </button>
            ) : (
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
                {t("calendarView.create.noOptions")}
              </div>
            )}
          </div>
        )}

        {mode === CALENDAR_CREATE_MODES.LIVE_TRAINING && (
          <TooltipProvider delayDuration={0}>
            <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
              <div className="min-h-0 overflow-y-auto overflow-x-hidden px-6 pb-4">
                <div className="min-w-0">
                  <CalendarCreateSection title={t("calendarView.create.section.basics")}>
                    <div className="grid gap-2">
                      <CalendarFormFieldLabel
                        htmlFor="live-training-title"
                        label={t("calendarView.create.field.title")}
                        tooltip={t("calendarView.create.tooltip.title")}
                      />
                      <Input
                        id="live-training-title"
                        value={formState.title}
                        maxLength={LIVE_TRAINING_TITLE_MAX_LENGTH}
                        onChange={(event) =>
                          updateFormState(
                            "title",
                            event.target.value.slice(0, LIVE_TRAINING_TITLE_MAX_LENGTH),
                          )
                        }
                        placeholder={t("calendarView.create.placeholder.title")}
                      />
                    </div>

                    <div className="grid gap-2">
                      <CalendarFormFieldLabel
                        htmlFor="live-training-description"
                        label={t("calendarView.create.field.description")}
                        tooltip={t("calendarView.create.tooltip.description")}
                      />
                      <Textarea
                        id="live-training-description"
                        value={formState.description}
                        maxLength={LIVE_TRAINING_DESCRIPTION_MAX_LENGTH}
                        onChange={(event) =>
                          updateFormState(
                            "description",
                            event.target.value.slice(0, LIVE_TRAINING_DESCRIPTION_MAX_LENGTH),
                          )
                        }
                        placeholder={t("calendarView.create.placeholder.description")}
                      />
                    </div>
                  </CalendarCreateSection>

                  <CalendarCreateSection title={t("calendarView.create.section.schedule")}>
                    <label
                      htmlFor="live-training-all-day"
                      className="flex w-full items-center justify-between gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2.5"
                    >
                      <CalendarFormFieldLabel
                        label={t("calendarView.create.field.allDay")}
                        tooltip={t("calendarView.create.tooltip.allDay")}
                      />
                      <Switch
                        id="live-training-all-day"
                        checked={formState.allDay}
                        onCheckedChange={(checked) => updateFormState("allDay", checked)}
                      />
                    </label>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <CalendarDateTimeField
                        label={t("calendarView.create.field.startsAt")}
                        tooltip={t("calendarView.create.tooltip.startsAt")}
                        date={formState.startDate}
                        time={formState.startTime}
                        portalledDatePicker={false}
                        hideTime={formState.allDay}
                        onDateChange={(date) => updateFormState("startDate", date)}
                        onTimeChange={(time) => updateFormState("startTime", time)}
                      />

                      <CalendarDateTimeField
                        label={t("calendarView.create.field.endsAt")}
                        tooltip={t("calendarView.create.tooltip.endsAt")}
                        date={formState.endDate}
                        time={formState.endTime}
                        portalledDatePicker={false}
                        hideTime={formState.allDay}
                        onDateChange={(date) => updateFormState("endDate", date)}
                        onTimeChange={(time) => updateFormState("endTime", time)}
                      />
                    </div>
                  </CalendarCreateSection>

                  <CalendarCreateSection title={t("calendarView.create.section.delivery")}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <CalendarFormFieldLabel
                          label={t("calendarView.create.field.deliveryType")}
                          tooltip={t("calendarView.create.tooltip.deliveryType")}
                        />
                        <Select
                          value={formState.deliveryType}
                          onValueChange={(value) =>
                            updateFormState(
                              "deliveryType",
                              value as CalendarCreateLiveTrainingFormState["deliveryType"],
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={LIVE_TRAINING_DELIVERY_TYPES.ONLINE}>
                              {t("calendarView.create.deliveryType.online")}
                            </SelectItem>
                            <SelectItem value={LIVE_TRAINING_DELIVERY_TYPES.OFFLINE}>
                              {t("calendarView.create.deliveryType.offline")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <CalendarFormFieldLabel
                          htmlFor="live-training-max-participants"
                          label={t("calendarView.create.field.maxParticipants")}
                          tooltip={t("calendarView.create.tooltip.maxParticipants")}
                        />
                        <Input
                          id="live-training-max-participants"
                          type="number"
                          min={1}
                          max={LIVE_TRAINING_MAX_PARTICIPANTS_LIMIT}
                          value={formState.maxParticipants}
                          onChange={(event) =>
                            updateFormState(
                              "maxParticipants",
                              Math.min(
                                LIVE_TRAINING_MAX_PARTICIPANTS_LIMIT,
                                Math.max(1, Number(event.target.value)),
                              ),
                            )
                          }
                        />
                      </div>
                    </div>

                    {formState.deliveryType === LIVE_TRAINING_DELIVERY_TYPES.OFFLINE && (
                      <div className="grid gap-2">
                        <CalendarFormFieldLabel
                          htmlFor="live-training-location"
                          label={t("calendarView.create.field.location")}
                          tooltip={t("calendarView.create.tooltip.location")}
                        />
                        <Input
                          id="live-training-location"
                          value={formState.location}
                          onChange={(event) => updateFormState("location", event.target.value)}
                          placeholder={t("calendarView.create.placeholder.location")}
                        />
                      </div>
                    )}
                  </CalendarCreateSection>

                  {formState.deliveryType === LIVE_TRAINING_DELIVERY_TYPES.ONLINE && (
                    <CalendarCreateSection title={t("calendarView.create.section.permissions")}>
                      <CalendarFormFieldLabel
                        label={t("calendarView.create.field.viewerPermissions")}
                        tooltip={t("calendarView.create.tooltip.viewerPermissions")}
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <CalendarViewerPermissionToggle
                          id="live-training-microphone-enabled"
                          checked={formState.microphoneEnabled}
                          label={t("calendarView.create.field.microphoneEnabled")}
                          tooltip={t("calendarView.create.tooltip.microphoneEnabled")}
                          icon={<Mic className="size-4" />}
                          onCheckedChange={(checked) =>
                            updateFormState("microphoneEnabled", checked)
                          }
                        />
                        <CalendarViewerPermissionToggle
                          id="live-training-camera-enabled"
                          checked={formState.cameraEnabled}
                          label={t("calendarView.create.field.cameraEnabled")}
                          tooltip={t("calendarView.create.tooltip.cameraEnabled")}
                          icon={<Video className="size-4" />}
                          onCheckedChange={(checked) => updateFormState("cameraEnabled", checked)}
                        />
                      </div>
                    </CalendarCreateSection>
                  )}
                </div>

                {formError && (
                  <p className="pt-4 text-sm font-medium text-error-600">{formError}</p>
                )}
              </div>

              <DialogFooter className="sticky bottom-0 gap-2 border-t border-neutral-200 bg-white px-6 py-4 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMode(CALENDAR_CREATE_MODES.MENU)}
                >
                  {t("common.button.back")}
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? t("common.button.saving") : t("calendarView.create.submit")}
                </Button>
              </DialogFooter>
            </form>
          </TooltipProvider>
        )}
      </DialogContent>
    </Dialog>
  );
}
