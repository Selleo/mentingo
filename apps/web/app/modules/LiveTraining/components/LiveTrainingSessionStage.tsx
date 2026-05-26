import { LIVE_TRAINING_DESCRIPTION_MAX_LENGTH, LIVE_TRAINING_TITLE_MAX_LENGTH } from "@repo/shared";
import {
  CalendarClock,
  Mic,
  MicOff,
  Play,
  Square,
  Trash2,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Input } from "~/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Switch } from "~/components/ui/switch";
import {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { CalendarDateTimeField } from "~/modules/Calendar/components/CalendarDateTimeField";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { LiveTrainingMeetingPreview } from "~/modules/LiveTraining/components/LiveTrainingMeeting/LiveTrainingMeetingPreview";
import { InlineEditable } from "~/modules/LiveTraining/components/LiveTrainingSessionStage/InlineEditable";
import { PreviewMetaItem } from "~/modules/LiveTraining/components/LiveTrainingSessionStage/PreviewMetaItem";
import { StageActionButton } from "~/modules/LiveTraining/components/LiveTrainingSessionStage/StageActionButton";
import { useLiveTrainingSessionStage } from "~/modules/LiveTraining/components/LiveTrainingSessionStage/useLiveTrainingSessionStage";
import { formatLiveTrainingDateRange } from "~/modules/LiveTraining/utils/liveTrainingFormat";

import type { UpdateLiveTrainingEditFormState } from "~/modules/LiveTraining/components/LiveTrainingSessionStage/LiveTrainingSessionStage.types";
import type {
  LiveTrainingDetails,
  LiveTrainingUiActions,
} from "~/modules/LiveTraining/liveTraining.types";
import type { LiveTrainingEditFormState } from "~/modules/LiveTraining/liveTrainingEdit.types";

type LiveTrainingSessionStageProps = {
  liveTraining: LiveTrainingDetails;
  actions: LiveTrainingUiActions;
  editFormState: LiveTrainingEditFormState | null;
  isStartingSession: boolean;
  isJoiningSession: boolean;
  isFinishingSession: boolean;
  isOnlineDeliveryAvailable: boolean;
  onDeleteClick: () => void;
  onStartSession: () => void;
  onJoinSession: () => void;
  onFinishSession: () => void;
  onEditFormStateChange: UpdateLiveTrainingEditFormState;
  onEditFormStateCommit: (nextFormState: LiveTrainingEditFormState) => void;
};

export function LiveTrainingSessionStage({
  liveTraining,
  actions,
  editFormState,
  isStartingSession,
  isJoiningSession,
  isFinishingSession,
  isOnlineDeliveryAvailable,
  onDeleteClick,
  onStartSession,
  onJoinSession,
  onFinishSession,
  onEditFormStateChange,
  onEditFormStateCommit,
}: LiveTrainingSessionStageProps) {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const {
    canEdit,
    commitCurrentFormState,
    descriptionRef,
    descriptionValue,
    displayedAllDay,
    displayedDeliveryType,
    displayedDescription,
    displayedEndsAt,
    displayedStartsAt,
    handleDescriptionBlur,
    handleDescriptionChange,
    handleMaxParticipantsChange,
    handleTitleBlur,
    handleTitleChange,
    isActive,
    isDescriptionAtLimit,
    isDescriptionFocused,
    isOffline,
    isOnlineDeliveryAvailable: canUseOnlineDelivery,
    isTitleAtLimit,
    isTitleFocused,
    setIsDescriptionFocused,
    setIsTitleFocused,
    shouldShowDescription,
    titleRef,
    titleValue,
    toggleDeliveryType,
    updateAndCommit,
  } = useLiveTrainingSessionStage({
    liveTraining,
    actions,
    editFormState,
    isOnlineDeliveryAvailable,
    onEditFormStateChange,
    onEditFormStateCommit,
  });
  const canToggleDeliveryType = canEdit && canUseOnlineDelivery;

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
                <InlineEditable
                  variant="text"
                  className={cn("relative block w-full max-w-4xl px-2 py-1", {
                    "pointer-events-none": !canEdit,
                  })}
                >
                  <textarea
                    ref={titleRef}
                    readOnly={!canEdit}
                    value={titleValue}
                    maxLength={LIVE_TRAINING_TITLE_MAX_LENGTH}
                    onChange={(event) => handleTitleChange(event.target.value)}
                    onFocus={() => setIsTitleFocused(true)}
                    onBlur={handleTitleBlur}
                    rows={1}
                    className="block w-full resize-none rounded-none border-0 bg-transparent p-0 text-xl font-semibold leading-tight text-white outline-none placeholder:text-white/40 focus:ring-0 sm:text-2xl"
                  />
                  {canEdit && isTitleFocused && (
                    <span
                      className={cn("absolute bottom-0 right-1 text-[10px] text-white/40", {
                        "text-warning-100": isTitleAtLimit,
                      })}
                    >
                      {Math.min(titleValue.length, LIVE_TRAINING_TITLE_MAX_LENGTH)}/
                      {LIVE_TRAINING_TITLE_MAX_LENGTH}
                    </span>
                  )}
                </InlineEditable>
                {shouldShowDescription && (
                  <InlineEditable
                    variant="text"
                    className={cn("relative mt-1 block w-full max-w-4xl px-2 py-1 sm:mt-2", {
                      "pointer-events-none": !canEdit,
                    })}
                  >
                    <span className="block w-full">
                      <textarea
                        ref={descriptionRef}
                        readOnly={!canEdit}
                        value={displayedDescription}
                        onChange={(event) => handleDescriptionChange(event.target.value)}
                        onFocus={() => setIsDescriptionFocused(true)}
                        onBlur={handleDescriptionBlur}
                        placeholder={
                          canEdit ? t("calendarView.create.placeholder.description") : ""
                        }
                        rows={2}
                        maxLength={LIVE_TRAINING_DESCRIPTION_MAX_LENGTH}
                        className="block w-full resize-none rounded-none border-0 bg-transparent p-0 text-xs leading-5 text-white/65 outline-none placeholder:text-white/40 focus:ring-0 sm:text-sm sm:leading-6"
                      />
                      {canEdit && isDescriptionFocused && (
                        <span
                          className={cn("absolute bottom-0 right-1 text-[10px] text-white/40", {
                            "text-warning-100": isDescriptionAtLimit,
                          })}
                        >
                          {Math.min(descriptionValue.length, LIVE_TRAINING_DESCRIPTION_MAX_LENGTH)}/
                          {LIVE_TRAINING_DESCRIPTION_MAX_LENGTH}
                        </span>
                      )}
                    </span>
                  </InlineEditable>
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
                    disabled={isStartingSession}
                    onClick={onStartSession}
                  />
                )}
                {actions.canShowFinish && (
                  <StageActionButton
                    icon={<Square className="size-4" />}
                    label={t("liveTrainingView.actions.finish")}
                    disabled={isFinishingSession}
                    onClick={onFinishSession}
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

                <button
                  type="button"
                  disabled={!canToggleDeliveryType}
                  onClick={toggleDeliveryType}
                  className="group rounded focus-visible:outline-none"
                >
                  <PreviewMetaItem
                    canEdit={canToggleDeliveryType}
                    value={t(`liveTrainingView.deliveryType.${displayedDeliveryType}`)}
                    tooltip={
                      canUseOnlineDelivery
                        ? t("calendarView.create.tooltip.deliveryType")
                        : t("calendarView.create.liveKitRequired")
                    }
                  />
                </button>

                {editFormState && (
                  <Popover
                    onOpenChange={(isOpen) => {
                      if (!isOpen) commitCurrentFormState();
                    }}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        disabled={!canEdit}
                        className="group rounded focus-visible:outline-none"
                      >
                        <PreviewMetaItem
                          canEdit={canEdit}
                          icon={<CalendarClock className="size-4" />}
                          value={formatLiveTrainingDateRange(
                            displayedStartsAt,
                            displayedEndsAt,
                            displayedAllDay,
                            language,
                          )}
                          tooltip={t("liveTrainingView.stage.scheduleTooltip")}
                        />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="grid w-[min(92vw,32rem)] gap-4 p-4">
                      <label
                        htmlFor="live-training-edit-all-day"
                        className="flex w-full items-center justify-between gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2.5"
                      >
                        <span className="text-sm font-medium text-neutral-900">
                          {t("calendarView.create.field.allDay")}
                        </span>
                        <Switch
                          id="live-training-edit-all-day"
                          checked={editFormState.allDay}
                          onCheckedChange={(checked) => onEditFormStateChange("allDay", checked)}
                        />
                      </label>
                      <CalendarDateTimeField
                        label={t("calendarView.create.field.startsAt")}
                        tooltip={t("calendarView.create.tooltip.startsAt")}
                        date={editFormState.startDate}
                        time={editFormState.startTime}
                        hideTime={editFormState.allDay}
                        onDateChange={(date) => onEditFormStateChange("startDate", date)}
                        onTimeChange={(time) => onEditFormStateChange("startTime", time)}
                      />
                      <CalendarDateTimeField
                        label={t("calendarView.create.field.endsAt")}
                        tooltip={t("calendarView.create.tooltip.endsAt")}
                        date={editFormState.endDate}
                        time={editFormState.endTime}
                        hideTime={editFormState.allDay}
                        onDateChange={(date) => onEditFormStateChange("endDate", date)}
                        onTimeChange={(time) => onEditFormStateChange("endTime", time)}
                      />
                    </PopoverContent>
                  </Popover>
                )}

                {editFormState && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className={cn(
                          "inline-flex h-8 max-w-[78vw] shrink-0 items-center gap-2 rounded border border-white/15 bg-white/10 px-2.5 text-xs text-white/85 sm:h-9 sm:max-w-none sm:px-3 sm:text-sm",
                          {
                            "transition-colors hover:border-dotted hover:border-white/60 focus-within:border-solid focus-within:border-white/75":
                              canEdit,
                          },
                        )}
                      >
                        <Users className="size-4 shrink-0 text-white/65" />
                        <Input
                          readOnly={!canEdit}
                          value={editFormState.maxParticipants}
                          onChange={(event) => handleMaxParticipantsChange(event.target.value)}
                          onBlur={commitCurrentFormState}
                          className="h-auto w-10 rounded-none border-0 bg-transparent p-0 text-xs text-white shadow-none focus-visible:ring-0 sm:text-sm"
                        />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      align="center"
                      className="max-w-xs whitespace-pre-line break-words rounded bg-black px-2 py-1 text-sm text-white shadow-md"
                    >
                      {t("calendarView.create.tooltip.maxParticipants")}
                      <TooltipArrow className="fill-black" />
                    </TooltipContent>
                  </Tooltip>
                )}

                {isOffline && editFormState && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className={cn(
                          "inline-flex h-8 max-w-[78vw] shrink-0 items-center rounded border border-white/15 bg-white/10 px-2.5 text-xs text-white/85 sm:h-9 sm:max-w-none sm:px-3 sm:text-sm",
                          {
                            "transition-colors hover:border-dotted hover:border-white/60 focus-within:border-solid focus-within:border-white/75":
                              canEdit,
                          },
                        )}
                      >
                        <Input
                          readOnly={!canEdit}
                          value={editFormState.location}
                          onChange={(event) =>
                            onEditFormStateChange("location", event.target.value)
                          }
                          onBlur={commitCurrentFormState}
                          placeholder={t("liveTrainingView.stage.locationMissing")}
                          className="h-auto w-48 truncate rounded-none border-0 bg-transparent p-0 text-xs text-white shadow-none placeholder:text-white/55 focus-visible:ring-0 sm:text-sm"
                        />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      align="center"
                      className="max-w-xs whitespace-pre-line break-words rounded bg-black px-2 py-1 text-sm text-white shadow-md"
                    >
                      {t("calendarView.create.tooltip.location")}
                      <TooltipArrow className="fill-black" />
                    </TooltipContent>
                  </Tooltip>
                )}

                {!isOffline && editFormState && (
                  <>
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() =>
                        updateAndCommit("microphoneEnabled", !editFormState.microphoneEnabled)
                      }
                      className="group rounded focus-visible:outline-none"
                    >
                      <PreviewMetaItem
                        canEdit={canEdit}
                        icon={
                          editFormState.microphoneEnabled ? (
                            <Mic className="size-4" />
                          ) : (
                            <MicOff className="size-4" />
                          )
                        }
                        value={
                          editFormState.microphoneEnabled
                            ? t("liveTrainingView.boolean.yes")
                            : t("liveTrainingView.boolean.no")
                        }
                        variant={editFormState.microphoneEnabled ? "default" : "danger"}
                        tooltip={t("liveTrainingView.stage.viewerMic")}
                      />
                    </button>
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => updateAndCommit("cameraEnabled", !editFormState.cameraEnabled)}
                      className="group rounded focus-visible:outline-none"
                    >
                      <PreviewMetaItem
                        canEdit={canEdit}
                        icon={
                          editFormState.cameraEnabled ? (
                            <Video className="size-4" />
                          ) : (
                            <VideoOff className="size-4" />
                          )
                        }
                        value={
                          editFormState.cameraEnabled
                            ? t("liveTrainingView.boolean.yes")
                            : t("liveTrainingView.boolean.no")
                        }
                        variant={editFormState.cameraEnabled ? "default" : "danger"}
                        tooltip={t("liveTrainingView.stage.viewerCamera")}
                      />
                    </button>
                  </>
                )}
              </div>
            </div>

            <LiveTrainingMeetingPreview
              liveTraining={liveTraining}
              actions={actions}
              isJoining={isJoiningSession}
              onJoin={onJoinSession}
            />
          </div>
        </div>
      </section>
    </TooltipProvider>
  );
}
