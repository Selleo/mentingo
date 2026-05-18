import {
  LIVE_TRAINING_DELIVERY_TYPES,
  LIVE_TRAINING_STATUSES,
} from "@repo/shared";
import { CalendarClock, Mic, Play, Square, Trash2, Users, Video } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { CalendarDateTimeField } from "~/modules/Calendar/components/CalendarDateTimeField";
import { CalendarFormFieldLabel } from "~/modules/Calendar/components/CalendarFormFieldLabel";
import { CalendarLanguageSelect } from "~/modules/Calendar/components/CalendarLanguageSelect";
import { CalendarViewerPermissionToggle } from "~/modules/Calendar/components/CalendarViewerPermissionToggle";
import { formatLiveTrainingDateRange } from "~/modules/LiveTraining/utils/liveTrainingFormat";

import type { ReactNode } from "react";
import type {
  LiveTrainingDetails,
  LiveTrainingUiActions,
} from "~/modules/LiveTraining/liveTraining.types";
import type { LiveTrainingEditFormState } from "~/modules/LiveTraining/liveTrainingEdit.types";

type UpdateLiveTrainingEditFormState = <Key extends keyof LiveTrainingEditFormState>(
  key: Key,
  value: LiveTrainingEditFormState[Key],
) => void;

type LiveTrainingSessionStageProps = {
  liveTraining: LiveTrainingDetails;
  actions: LiveTrainingUiActions;
  editFormState: LiveTrainingEditFormState | null;
  onDeleteClick: () => void;
  onEditFormStateChange: UpdateLiveTrainingEditFormState;
  onEditPopoverClose: () => void;
};

type EditablePopoverProps = {
  canEdit: boolean;
  children: ReactNode;
  className?: string;
  content: ReactNode;
  onClose: () => void;
};

type PreviewMetaItemProps = {
  icon?: ReactNode;
  value: ReactNode;
  tooltip: string;
  canEdit?: boolean;
};

type StageActionButtonProps = {
  icon: ReactNode;
  label: string;
  variant?: "primary" | "secondary";
  onClick?: () => void;
};

const buildDateTime = (date: string, time: string) => new Date(`${date}T${time}:00`).toISOString();

function EditablePopover({ canEdit, children, className, content, onClose }: EditablePopoverProps) {
  if (!canEdit) return children;

  return (
    <Popover
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "rounded text-left transition-colors hover:bg-white/5 hover:outline hover:outline-1 hover:outline-dotted hover:outline-white/70 focus-visible:outline focus-visible:outline-1 focus-visible:outline-dotted focus-visible:outline-white/80",
            className,
          )}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(92vw,32rem)] p-4">
        {content}
      </PopoverContent>
    </Popover>
  );
}

function PreviewMetaItem({ icon, value, tooltip, canEdit }: PreviewMetaItemProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex h-8 max-w-[78vw] shrink-0 items-center gap-2 rounded border border-white/15 bg-white/10 px-2.5 text-xs text-white/85 sm:h-9 sm:max-w-none sm:px-3 sm:text-sm",
            {
              "transition-colors hover:border-white/30 hover:bg-white/15": canEdit,
            },
          )}
        >
          {icon && <span className="text-white/65">{icon}</span>}
          <span className="min-w-0 truncate">{value}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="center"
        className="max-w-xs whitespace-pre-line break-words rounded bg-black px-2 py-1 text-sm text-white shadow-md"
      >
        {tooltip}
        <TooltipArrow className="fill-black" />
      </TooltipContent>
    </Tooltip>
  );
}

function StageActionButton({
  icon,
  label,
  variant = "secondary",
  onClick,
}: StageActionButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={variant === "primary" ? "default" : "outline"}
          aria-label={label}
          onClick={onClick}
          className={cn("h-8 w-8 gap-2 px-0 sm:h-9 sm:w-auto sm:px-3", {
            "bg-white text-neutral-950 hover:bg-white/90": variant === "primary",
            "border-white/15 bg-white/10 text-white hover:border-white/30 hover:bg-white/15 hover:text-white":
              variant === "secondary",
          })}
        >
          {icon}
          <span className="hidden sm:inline">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="center"
        className="rounded bg-black px-2 py-1 text-sm text-white shadow-md sm:hidden"
      >
        {label}
        <TooltipArrow className="fill-black" />
      </TooltipContent>
    </Tooltip>
  );
}

export function LiveTrainingSessionStage({
  liveTraining,
  actions,
  editFormState,
  onDeleteClick,
  onEditFormStateChange,
  onEditPopoverClose,
}: LiveTrainingSessionStageProps) {
  const { t } = useTranslation();
  const canEdit = actions.canShowEdit && Boolean(editFormState);
  const displayedDeliveryType = editFormState?.deliveryType ?? liveTraining.deliveryType;
  const isOffline = displayedDeliveryType === LIVE_TRAINING_DELIVERY_TYPES.OFFLINE;
  const isActive = liveTraining.status === LIVE_TRAINING_STATUSES.ACTIVE;
  const displayedStartsAt = editFormState
    ? buildDateTime(editFormState.startDate, editFormState.startTime)
    : liveTraining.startsAt;
  const displayedEndsAt = editFormState
    ? buildDateTime(editFormState.endDate, editFormState.endTime)
    : liveTraining.endsAt;

  return (
    <TooltipProvider delayDuration={0}>
      <section className="overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm">
        <div className="relative bg-primary-950 p-3 text-white sm:min-h-[240px] sm:p-5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.16),transparent_28%),linear-gradient(135deg,var(--primary-800),var(--primary-950)_48%,var(--primary-900))]" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-white/15" />
          <div className="relative flex min-h-[170px] flex-col justify-between gap-5 sm:min-h-[200px] sm:gap-8">
            <div className="flex items-start justify-between gap-3 lg:gap-5">
              <div className="min-w-0 flex-1">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-white/55 sm:mb-3 sm:text-xs">
                  {t("liveTrainingView.title")}
                </p>
                <EditablePopover
                  canEdit={canEdit}
                  className="-m-1 block w-full max-w-4xl p-1"
                  onClose={onEditPopoverClose}
                  content={
                    <div className="grid gap-2">
                      <CalendarFormFieldLabel
                        htmlFor="live-training-edit-title"
                        label={t("calendarView.create.field.title")}
                        tooltip={t("calendarView.create.tooltip.title")}
                      />
                      <Input
                        id="live-training-edit-title"
                        value={editFormState?.title ?? ""}
                        onChange={(event) => onEditFormStateChange("title", event.target.value)}
                        placeholder={t("calendarView.create.placeholder.title")}
                      />
                    </div>
                  }
                >
                  <h1 className="max-w-4xl text-xl font-semibold leading-tight sm:text-2xl">
                    {editFormState?.title || liveTraining.title}
                  </h1>
                </EditablePopover>
                {(editFormState?.description || liveTraining.description) && (
                  <EditablePopover
                    canEdit={canEdit}
                    className="mt-1 block w-full max-w-4xl p-1 sm:mt-2"
                    onClose={onEditPopoverClose}
                    content={
                      <div className="grid gap-2">
                        <CalendarFormFieldLabel
                          htmlFor="live-training-edit-description"
                          label={t("calendarView.create.field.description")}
                          tooltip={t("calendarView.create.tooltip.description")}
                        />
                        <Textarea
                          id="live-training-edit-description"
                          value={editFormState?.description ?? ""}
                          onChange={(event) =>
                            onEditFormStateChange("description", event.target.value)
                          }
                          placeholder={t("calendarView.create.placeholder.description")}
                        />
                      </div>
                    }
                  >
                    <p className="max-w-4xl text-xs leading-5 text-white/65 sm:text-sm sm:leading-6">
                      {editFormState?.description || liveTraining.description}
                    </p>
                  </EditablePopover>
                )}
              </div>

              <div className="flex shrink-0 flex-wrap justify-end gap-1.5 sm:gap-2">
                {actions.canShowDelete && (
                  <StageActionButton
                    icon={<Trash2 className="size-4" />}
                    label={t("liveTrainingView.actions.delete")}
                    onClick={onDeleteClick}
                  />
                )}
                {actions.canShowStart && (
                  <StageActionButton
                    icon={<Play className="size-4" />}
                    label={t("liveTrainingView.actions.start")}
                    variant="primary"
                  />
                )}
                {actions.canShowFinish && (
                  <StageActionButton
                    icon={<Square className="size-4" />}
                    label={t("liveTrainingView.actions.finish")}
                  />
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
                <span
                  className={cn(
                    "inline-flex h-8 shrink-0 items-center rounded border border-white/15 bg-white/10 px-2.5 text-xs font-medium text-white/85 sm:h-9 sm:px-3 sm:text-sm",
                    {
                      "text-success-100": isActive,
                    },
                  )}
                >
                  {t(`liveTrainingView.status.${liveTraining.status}`)}
                </span>

                <EditablePopover
                  canEdit={canEdit}
                  onClose={onEditPopoverClose}
                  content={
                    <div className="grid gap-2">
                      <CalendarFormFieldLabel
                        label={t("calendarView.create.field.deliveryType")}
                        tooltip={t("calendarView.create.tooltip.deliveryType")}
                      />
                      <Select
                        value={displayedDeliveryType}
                        onValueChange={(value) =>
                          onEditFormStateChange(
                            "deliveryType",
                            value as LiveTrainingEditFormState["deliveryType"],
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
                  }
                >
                  <PreviewMetaItem
                    canEdit={canEdit}
                    value={t(`liveTrainingView.deliveryType.${displayedDeliveryType}`)}
                    tooltip={t("calendarView.create.tooltip.deliveryType")}
                  />
                </EditablePopover>

                {editFormState && (
                  <EditablePopover
                    canEdit={canEdit}
                    onClose={onEditPopoverClose}
                    content={
                      <div className="grid gap-4">
                        <CalendarDateTimeField
                          label={t("calendarView.create.field.startsAt")}
                          tooltip={t("calendarView.create.tooltip.startsAt")}
                          date={editFormState.startDate}
                          time={editFormState.startTime}
                          onDateChange={(date) => onEditFormStateChange("startDate", date)}
                          onTimeChange={(time) => onEditFormStateChange("startTime", time)}
                        />
                        <CalendarDateTimeField
                          label={t("calendarView.create.field.endsAt")}
                          tooltip={t("calendarView.create.tooltip.endsAt")}
                          date={editFormState.endDate}
                          time={editFormState.endTime}
                          onDateChange={(date) => onEditFormStateChange("endDate", date)}
                          onTimeChange={(time) => onEditFormStateChange("endTime", time)}
                        />
                      </div>
                    }
                  >
                    <PreviewMetaItem
                      canEdit={canEdit}
                      icon={<CalendarClock className="size-4" />}
                      value={formatLiveTrainingDateRange(displayedStartsAt, displayedEndsAt)}
                      tooltip={t("liveTrainingView.stage.scheduleTooltip")}
                    />
                  </EditablePopover>
                )}

                {editFormState && (
                  <EditablePopover
                    canEdit={canEdit}
                    onClose={onEditPopoverClose}
                    content={
                      <CalendarLanguageSelect
                        value={editFormState.language}
                        label={t("calendarView.create.field.language")}
                        tooltip={t("calendarView.create.tooltip.language")}
                        onChange={(language) => onEditFormStateChange("language", language)}
                      />
                    }
                  >
                    <PreviewMetaItem
                      canEdit={canEdit}
                      value={editFormState.language.toUpperCase()}
                      tooltip={t("calendarView.create.tooltip.language")}
                    />
                  </EditablePopover>
                )}

                {editFormState && (
                  <EditablePopover
                    canEdit={canEdit}
                    onClose={onEditPopoverClose}
                    content={
                      <div className="grid gap-2">
                        <CalendarFormFieldLabel
                          htmlFor="live-training-edit-max-participants"
                          label={t("calendarView.create.field.maxParticipants")}
                          tooltip={t("calendarView.create.tooltip.maxParticipants")}
                        />
                        <Input
                          id="live-training-edit-max-participants"
                          type="number"
                          value={editFormState.maxParticipants}
                          onChange={(event) =>
                            onEditFormStateChange("maxParticipants", event.target.value)
                          }
                        />
                      </div>
                    }
                  >
                    <PreviewMetaItem
                      canEdit={canEdit}
                      icon={<Users className="size-4" />}
                      value={editFormState.maxParticipants}
                      tooltip={t("liveTrainingView.stage.maxParticipantsTooltip")}
                    />
                  </EditablePopover>
                )}

                {isOffline && editFormState && (
                  <EditablePopover
                    canEdit={canEdit}
                    onClose={onEditPopoverClose}
                    content={
                      <div className="grid gap-2">
                        <CalendarFormFieldLabel
                          htmlFor="live-training-edit-location"
                          label={t("calendarView.create.field.location")}
                          tooltip={t("calendarView.create.tooltip.location")}
                        />
                        <Input
                          id="live-training-edit-location"
                          value={editFormState.location}
                          onChange={(event) =>
                            onEditFormStateChange("location", event.target.value)
                          }
                          placeholder={t("calendarView.create.placeholder.location")}
                        />
                      </div>
                    }
                  >
                    <PreviewMetaItem
                      canEdit={canEdit}
                      value={editFormState.location || t("liveTrainingView.stage.locationMissing")}
                      tooltip={t("liveTrainingView.stage.locationTooltip")}
                    />
                  </EditablePopover>
                )}

                {!isOffline && editFormState && (
                  <EditablePopover
                    canEdit={canEdit}
                    onClose={onEditPopoverClose}
                    content={
                      <CalendarViewerPermissionToggle
                        id="live-training-edit-microphone-enabled"
                        checked={editFormState.microphoneEnabled}
                        label={t("calendarView.create.field.microphoneEnabled")}
                        tooltip={t("calendarView.create.tooltip.microphoneEnabled")}
                        icon={<Mic className="size-4" />}
                        onCheckedChange={(checked) =>
                          onEditFormStateChange("microphoneEnabled", checked)
                        }
                      />
                    }
                  >
                    <PreviewMetaItem
                      canEdit={canEdit}
                      icon={<Mic className="size-4" />}
                      value={
                        editFormState.microphoneEnabled
                          ? t("liveTrainingView.boolean.yes")
                          : t("liveTrainingView.boolean.no")
                      }
                      tooltip={t("liveTrainingView.stage.viewerMic")}
                    />
                  </EditablePopover>
                )}
                {!isOffline && editFormState && (
                  <EditablePopover
                    canEdit={canEdit}
                    onClose={onEditPopoverClose}
                    content={
                      <CalendarViewerPermissionToggle
                        id="live-training-edit-camera-enabled"
                        checked={editFormState.cameraEnabled}
                        label={t("calendarView.create.field.cameraEnabled")}
                        tooltip={t("calendarView.create.tooltip.cameraEnabled")}
                        icon={<Video className="size-4" />}
                        onCheckedChange={(checked) => onEditFormStateChange("cameraEnabled", checked)}
                      />
                    }
                  >
                    <PreviewMetaItem
                      canEdit={canEdit}
                      icon={<Video className="size-4" />}
                      value={
                        editFormState.cameraEnabled
                          ? t("liveTrainingView.boolean.yes")
                          : t("liveTrainingView.boolean.no")
                      }
                      tooltip={t("liveTrainingView.stage.viewerCamera")}
                    />
                  </EditablePopover>
                )}
              </div>

              {actions.canShowJoin && (
                <Button className="h-9 shrink-0 gap-2 bg-white text-primary-950 hover:bg-white/90 sm:h-10">
                  <Video className="size-4" />
                  {t("liveTrainingView.actions.join")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>
    </TooltipProvider>
  );
}
