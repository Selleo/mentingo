import {
  DEFAULT_LIVE_TRAINING_SETTINGS,
  LIVE_TRAINING_DELIVERY_TYPES,
  LIVE_TRAINING_MAX_PARTICIPANTS_LIMIT,
  type SupportedLanguages,
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
import { Textarea } from "~/components/ui/textarea";
import { TooltipProvider } from "~/components/ui/tooltip";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import {
  CALENDAR_CREATE_MODES,
  type CalendarCreateLiveTrainingDialogProps,
  type CalendarCreateLiveTrainingFormState,
  type CalendarCreateMode,
} from "./calendarCreateLiveTraining.types";
import { CalendarDateTimeField } from "./CalendarDateTimeField";
import { CalendarFormFieldLabel } from "./CalendarFormFieldLabel";
import { CalendarLanguageSelect } from "./CalendarLanguageSelect";
import { CalendarViewerPermissionToggle } from "./CalendarViewerPermissionToggle";

import type { FormEvent } from "react";
import type { CreateLiveTrainingBody } from "~/api/generated-api";

const padDatePart = (value: number) => String(value).padStart(2, "0");

const toDateInputValue = (date: Date) =>
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;

const toTimeInputValue = (date: Date) =>
  `${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`;

const getDefaultDateRange = (
  selectedRange: CalendarCreateLiveTrainingDialogProps["selectedRange"],
) => {
  const startsAt = selectedRange?.start ? new Date(selectedRange.start) : new Date();

  if (
    !selectedRange ||
    selectedRange.allDay ||
    (startsAt.getHours() === 0 && startsAt.getMinutes() === 0)
  ) {
    startsAt.setHours(9, 0, 0, 0);
  }

  const endsAt = selectedRange?.end ? new Date(selectedRange.end) : new Date(startsAt);

  if (selectedRange?.allDay && selectedRange.end) {
    endsAt.setDate(endsAt.getDate() - 1);
    endsAt.setHours(17, 0, 0, 0);
  }

  if (endsAt <= startsAt) {
    endsAt.setTime(startsAt.getTime());
    endsAt.setHours(startsAt.getHours() + 1);
  }

  return { startsAt, endsAt };
};

const buildDateTime = (date: string, time: string) => new Date(`${date}T${time}:00`);

const buildInitialFormState = (
  selectedRange: CalendarCreateLiveTrainingDialogProps["selectedRange"],
  language: SupportedLanguages,
): CalendarCreateLiveTrainingFormState => {
  const { startsAt, endsAt } = getDefaultDateRange(selectedRange);

  return {
    title: "",
    description: "",
    language,
    startDate: toDateInputValue(startsAt),
    startTime: toTimeInputValue(startsAt),
    endDate: toDateInputValue(endsAt),
    endTime: toTimeInputValue(endsAt),
    deliveryType: LIVE_TRAINING_DELIVERY_TYPES.ONLINE,
    location: "",
    maxParticipants: LIVE_TRAINING_MAX_PARTICIPANTS_LIMIT,
    microphoneEnabled: DEFAULT_LIVE_TRAINING_SETTINGS.viewerPermissions.microphoneEnabled,
    cameraEnabled: DEFAULT_LIVE_TRAINING_SETTINGS.viewerPermissions.cameraEnabled,
  };
};

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
    () => buildInitialFormState(selectedRange, appLanguage),
    [selectedRange, appLanguage],
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

    const startsAt = buildDateTime(formState.startDate, formState.startTime);
    const endsAt = buildDateTime(formState.endDate, formState.endTime);

    if (!formState.title.trim()) {
      setFormError(t("calendarView.create.validation.titleRequired"));
      return;
    }

    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      setFormError(t("calendarView.create.validation.invalidDateRange"));
      return;
    }

    if (
      formState.deliveryType === LIVE_TRAINING_DELIVERY_TYPES.OFFLINE &&
      !formState.location.trim()
    ) {
      setFormError(t("calendarView.create.validation.locationRequired"));
      return;
    }

    setFormError(null);

    const payload: CreateLiveTrainingBody = {
      title: formState.title.trim(),
      description: formState.description.trim() || null,
      language: formState.language,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      timezone,
      deliveryType: formState.deliveryType,
      location:
        formState.deliveryType === LIVE_TRAINING_DELIVERY_TYPES.OFFLINE
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
              <div className="grid min-h-0 gap-4 overflow-y-auto px-6 pb-4">
                <div className="grid gap-2">
                  <CalendarFormFieldLabel
                    htmlFor="live-training-title"
                    label={t("calendarView.create.field.title")}
                    tooltip={t("calendarView.create.tooltip.title")}
                  />
                  <Input
                    id="live-training-title"
                    value={formState.title}
                    onChange={(event) => updateFormState("title", event.target.value)}
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
                    onChange={(event) => updateFormState("description", event.target.value)}
                    placeholder={t("calendarView.create.placeholder.description")}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <CalendarLanguageSelect
                    value={formState.language}
                    label={t("calendarView.create.field.language")}
                    tooltip={t("calendarView.create.tooltip.language")}
                    onChange={(language) => updateFormState("language", language)}
                  />

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
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <CalendarDateTimeField
                    label={t("calendarView.create.field.startsAt")}
                    tooltip={t("calendarView.create.tooltip.startsAt")}
                    date={formState.startDate}
                    time={formState.startTime}
                    onDateChange={(date) => updateFormState("startDate", date)}
                    onTimeChange={(time) => updateFormState("startTime", time)}
                  />

                  <CalendarDateTimeField
                    label={t("calendarView.create.field.endsAt")}
                    tooltip={t("calendarView.create.tooltip.endsAt")}
                    date={formState.endDate}
                    time={formState.endTime}
                    onDateChange={(date) => updateFormState("endDate", date)}
                    onTimeChange={(time) => updateFormState("endTime", time)}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
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
                </div>

                {formState.deliveryType === LIVE_TRAINING_DELIVERY_TYPES.ONLINE && (
                  <div className="grid gap-3">
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
                        onCheckedChange={(checked) => updateFormState("microphoneEnabled", checked)}
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
                  </div>
                )}

                {formError && <p className="text-sm font-medium text-error-600">{formError}</p>}
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
