import {
  LIVE_TRAINING_DELIVERY_TYPES,
  LIVE_TRAINING_DESCRIPTION_MAX_LENGTH,
  LIVE_TRAINING_MAX_PARTICIPANTS_LIMIT,
  LIVE_TRAINING_TITLE_MAX_LENGTH,
} from "@repo/shared";
import { Mic, Video } from "lucide-react";
import { useTranslation } from "react-i18next";

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
import { CalendarDateTimeField } from "~/modules/Calendar/components/CalendarDateTimeField";
import { CalendarFormFieldLabel } from "~/modules/Calendar/components/CalendarFormFieldLabel";
import { CalendarViewerPermissionToggle } from "~/modules/Calendar/components/CalendarViewerPermissionToggle";

import type {
  LiveTrainingFormFieldUpdater,
  LiveTrainingFormState,
} from "../liveTrainingForm.types";
import type { ReactNode } from "react";

type LiveTrainingFormSectionProps = {
  title: string;
  children: ReactNode;
};

type LiveTrainingFormFieldsProps = {
  formState: LiveTrainingFormState;
  onFormStateChange: LiveTrainingFormFieldUpdater;
  idPrefix?: string;
  portalledDatePicker?: boolean;
};

function LiveTrainingFormSection({ title, children }: LiveTrainingFormSectionProps) {
  return (
    <section className="grid gap-4 border-t border-neutral-200 py-5 first:border-t-0 first:pt-0 last:pb-0">
      <h3 className="text-xs font-semibold uppercase text-neutral-500">{title}</h3>
      {children}
    </section>
  );
}

export function LiveTrainingFormFields({
  formState,
  onFormStateChange,
  idPrefix = "live-training",
  portalledDatePicker = false,
}: LiveTrainingFormFieldsProps) {
  const { t } = useTranslation();
  const titleId = `${idPrefix}-title`;
  const descriptionId = `${idPrefix}-description`;
  const allDayId = `${idPrefix}-all-day`;
  const maxParticipantsId = `${idPrefix}-max-participants`;
  const locationId = `${idPrefix}-location`;
  const microphoneId = `${idPrefix}-microphone-enabled`;
  const cameraId = `${idPrefix}-camera-enabled`;

  return (
    <div className="min-w-0">
      <LiveTrainingFormSection title={t("calendarView.create.section.basics")}>
        <div className="grid gap-2">
          <CalendarFormFieldLabel
            htmlFor={titleId}
            label={t("calendarView.create.field.title")}
            tooltip={t("calendarView.create.tooltip.title")}
          />
          <Input
            id={titleId}
            value={formState.title}
            maxLength={LIVE_TRAINING_TITLE_MAX_LENGTH}
            onChange={(event) =>
              onFormStateChange(
                "title",
                event.target.value.slice(0, LIVE_TRAINING_TITLE_MAX_LENGTH),
              )
            }
            placeholder={t("calendarView.create.placeholder.title")}
          />
        </div>

        <div className="grid gap-2">
          <CalendarFormFieldLabel
            htmlFor={descriptionId}
            label={t("calendarView.create.field.description")}
            tooltip={t("calendarView.create.tooltip.description")}
          />
          <Textarea
            id={descriptionId}
            value={formState.description}
            maxLength={LIVE_TRAINING_DESCRIPTION_MAX_LENGTH}
            onChange={(event) =>
              onFormStateChange(
                "description",
                event.target.value.slice(0, LIVE_TRAINING_DESCRIPTION_MAX_LENGTH),
              )
            }
            placeholder={t("calendarView.create.placeholder.description")}
          />
        </div>
      </LiveTrainingFormSection>

      <LiveTrainingFormSection title={t("calendarView.create.section.schedule")}>
        <label
          htmlFor={allDayId}
          className="flex w-full items-center justify-between gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2.5"
        >
          <CalendarFormFieldLabel
            label={t("calendarView.create.field.allDay")}
            tooltip={t("calendarView.create.tooltip.allDay")}
          />
          <Switch
            id={allDayId}
            checked={formState.allDay}
            onCheckedChange={(checked) => onFormStateChange("allDay", checked)}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <CalendarDateTimeField
            label={t("calendarView.create.field.startsAt")}
            tooltip={t("calendarView.create.tooltip.startsAt")}
            date={formState.startDate}
            time={formState.startTime}
            portalledDatePicker={portalledDatePicker}
            hideTime={formState.allDay}
            onDateChange={(date) => onFormStateChange("startDate", date)}
            onTimeChange={(time) => onFormStateChange("startTime", time)}
          />

          <CalendarDateTimeField
            label={t("calendarView.create.field.endsAt")}
            tooltip={t("calendarView.create.tooltip.endsAt")}
            date={formState.endDate}
            time={formState.endTime}
            portalledDatePicker={portalledDatePicker}
            hideTime={formState.allDay}
            onDateChange={(date) => onFormStateChange("endDate", date)}
            onTimeChange={(time) => onFormStateChange("endTime", time)}
          />
        </div>
      </LiveTrainingFormSection>

      <LiveTrainingFormSection title={t("calendarView.create.section.delivery")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <CalendarFormFieldLabel
              label={t("calendarView.create.field.deliveryType")}
              tooltip={t("calendarView.create.tooltip.deliveryType")}
            />
            <Select
              value={formState.deliveryType}
              onValueChange={(value) =>
                onFormStateChange("deliveryType", value as LiveTrainingFormState["deliveryType"])
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
              htmlFor={maxParticipantsId}
              label={t("calendarView.create.field.maxParticipants")}
              tooltip={t("calendarView.create.tooltip.maxParticipants")}
            />
            <Input
              id={maxParticipantsId}
              type="number"
              min={1}
              max={LIVE_TRAINING_MAX_PARTICIPANTS_LIMIT}
              value={formState.maxParticipants}
              onChange={(event) =>
                onFormStateChange(
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

        {formState.deliveryType === LIVE_TRAINING_DELIVERY_TYPES.OFFLINE ? (
          <div className="grid gap-2">
            <CalendarFormFieldLabel
              htmlFor={locationId}
              label={t("calendarView.create.field.location")}
              tooltip={t("calendarView.create.tooltip.location")}
            />
            <Input
              id={locationId}
              value={formState.location}
              onChange={(event) => onFormStateChange("location", event.target.value)}
              placeholder={t("calendarView.create.placeholder.location")}
            />
          </div>
        ) : null}
      </LiveTrainingFormSection>

      {formState.deliveryType === LIVE_TRAINING_DELIVERY_TYPES.ONLINE ? (
        <LiveTrainingFormSection title={t("calendarView.create.section.permissions")}>
          <CalendarFormFieldLabel
            label={t("calendarView.create.field.viewerPermissions")}
            tooltip={t("calendarView.create.tooltip.viewerPermissions")}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <CalendarViewerPermissionToggle
              id={microphoneId}
              checked={formState.microphoneEnabled}
              label={t("calendarView.create.field.microphoneEnabled")}
              tooltip={t("calendarView.create.tooltip.microphoneEnabled")}
              icon={<Mic className="size-4" />}
              onCheckedChange={(checked) => onFormStateChange("microphoneEnabled", checked)}
            />
            <CalendarViewerPermissionToggle
              id={cameraId}
              checked={formState.cameraEnabled}
              label={t("calendarView.create.field.cameraEnabled")}
              tooltip={t("calendarView.create.tooltip.cameraEnabled")}
              icon={<Video className="size-4" />}
              onCheckedChange={(checked) => onFormStateChange("cameraEnabled", checked)}
            />
          </div>
        </LiveTrainingFormSection>
      ) : null}
    </div>
  );
}
