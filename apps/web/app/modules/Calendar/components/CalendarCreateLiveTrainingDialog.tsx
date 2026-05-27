import { LIVE_TRAINING_DELIVERY_TYPES } from "@repo/shared";
import { CalendarPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCreateLiveTraining } from "~/api/mutations/live-training/useCreateLiveTraining";
import { useLiveKitConfigured } from "~/api/queries/useLiveKitConfigured";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { TooltipProvider } from "~/components/ui/tooltip";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { LiveTrainingFormFields } from "~/modules/LiveTraining/components/LiveTrainingFormFields";

import { CALENDAR_HANDLES } from "../../../../e2e/data/live-training/handles";

import { CALENDAR_CREATE_MODES } from "./calendarCreateLiveTraining.constants";
import { getCalendarCreateLiveTrainingSchema } from "./calendarCreateLiveTraining.schema";
import {
  buildCalendarCreateAllDayEndDateTime,
  buildCalendarCreateAllDayStartDateTime,
  buildCalendarCreateDateTime,
  buildInitialCalendarCreateLiveTrainingFormState,
} from "./calendarCreateLiveTraining.utils";

import type {
  CalendarCreateLiveTrainingDialogProps,
  CalendarCreateLiveTrainingFormState,
  CalendarCreateMode,
} from "./calendarCreateLiveTraining.types";
import type { FormEvent } from "react";
import type { CreateLiveTrainingBody } from "~/api/generated-api";

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
  const { data: liveKitConfigured } = useLiveKitConfigured();
  const isOnlineDeliveryAvailable = Boolean(liveKitConfigured?.enabled);

  const initialFormState = useMemo(
    () =>
      buildInitialCalendarCreateLiveTrainingFormState(
        selectedRange,
        isOnlineDeliveryAvailable
          ? LIVE_TRAINING_DELIVERY_TYPES.ONLINE
          : LIVE_TRAINING_DELIVERY_TYPES.OFFLINE,
      ),
    [isOnlineDeliveryAvailable, selectedRange],
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

    if (
      formState.deliveryType === LIVE_TRAINING_DELIVERY_TYPES.ONLINE &&
      !isOnlineDeliveryAvailable
    ) {
      updateFormState("deliveryType", LIVE_TRAINING_DELIVERY_TYPES.OFFLINE);
      setFormError(t("calendarView.create.liveKitRequired"));
      return;
    }

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
      <DialogContent
        data-testid={CALENDAR_HANDLES.CREATE_DIALOG}
        className="flex max-h-[92dvh] flex-col overflow-hidden p-0 sm:max-w-[720px]"
      >
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
                data-testid={CALENDAR_HANDLES.CREATE_LIVE_TRAINING_OPTION}
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
                <LiveTrainingFormFields
                  formState={formState}
                  onFormStateChange={updateFormState}
                  idPrefix="calendar-live-training"
                  portalledDatePicker={false}
                  isOnlineDeliveryAvailable={isOnlineDeliveryAvailable}
                />

                {formError && (
                  <p className="pt-4 text-sm font-medium text-error-600">{formError}</p>
                )}
              </div>

              <DialogFooter className="sticky bottom-0 gap-2 border-t border-neutral-200 bg-white px-6 py-4 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  data-testid={CALENDAR_HANDLES.CREATE_BACK_BUTTON}
                  onClick={() => setMode(CALENDAR_CREATE_MODES.MENU)}
                >
                  {t("common.button.back")}
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  data-testid={CALENDAR_HANDLES.CREATE_SUBMIT_BUTTON}
                >
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
