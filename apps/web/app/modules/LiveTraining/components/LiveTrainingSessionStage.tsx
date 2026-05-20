import {
  LIVE_TRAINING_DELIVERY_TYPES,
  LIVE_TRAINING_DESCRIPTION_MAX_LENGTH,
  LIVE_TRAINING_STATUSES,
  LIVE_TRAINING_TITLE_MAX_LENGTH,
} from "@repo/shared";
import { CalendarClock, Mic, Play, Square, Trash2, Users, Video } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { CalendarDateTimeField } from "~/modules/Calendar/components/CalendarDateTimeField";
import { InlineEditable } from "~/modules/LiveTraining/components/LiveTrainingSessionStage/InlineEditable";
import {
  LIVE_TRAINING_DESCRIPTION_MAX_HEIGHT,
  LIVE_TRAINING_TITLE_MAX_HEIGHT,
} from "~/modules/LiveTraining/components/LiveTrainingSessionStage/LiveTrainingSessionStage.constants";
import {
  buildLiveTrainingStageDateTime,
  limitLiveTrainingDescription,
  limitLiveTrainingTitle,
  resizeLiveTrainingTextArea,
  trimLiveTrainingDescriptionForPreview,
} from "~/modules/LiveTraining/components/LiveTrainingSessionStage/LiveTrainingSessionStage.utils";
import { PreviewMetaItem } from "~/modules/LiveTraining/components/LiveTrainingSessionStage/PreviewMetaItem";
import { StageActionButton } from "~/modules/LiveTraining/components/LiveTrainingSessionStage/StageActionButton";
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
  onDeleteClick: () => void;
  onEditFormStateChange: UpdateLiveTrainingEditFormState;
  onEditFormStateCommit: (nextFormState: LiveTrainingEditFormState) => void;
};

export function LiveTrainingSessionStage({
  liveTraining,
  actions,
  editFormState,
  onDeleteClick,
  onEditFormStateChange,
  onEditFormStateCommit,
}: LiveTrainingSessionStageProps) {
  const { t } = useTranslation();
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const [isDescriptionFocused, setIsDescriptionFocused] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const canEdit = actions.canShowEdit && Boolean(editFormState);
  const displayedDeliveryType = editFormState?.deliveryType ?? liveTraining.deliveryType;
  const isOffline = displayedDeliveryType === LIVE_TRAINING_DELIVERY_TYPES.OFFLINE;
  const isActive = liveTraining.status === LIVE_TRAINING_STATUSES.ACTIVE;
  const titleValue = editFormState?.title ?? liveTraining.title;
  const isTitleAtLimit = canEdit && titleValue.length >= LIVE_TRAINING_TITLE_MAX_LENGTH;
  const hasDescription = Boolean(editFormState?.description || liveTraining.description);
  const shouldShowDescription = canEdit || hasDescription;
  const descriptionValue = editFormState?.description ?? liveTraining.description ?? "";
  const displayedDescription = canEdit
    ? descriptionValue
    : trimLiveTrainingDescriptionForPreview(descriptionValue);
  const isDescriptionAtLimit =
    canEdit && descriptionValue.length >= LIVE_TRAINING_DESCRIPTION_MAX_LENGTH;
  const displayedStartsAt = editFormState
    ? buildLiveTrainingStageDateTime(editFormState.startDate, editFormState.startTime)
    : liveTraining.startsAt;
  const displayedEndsAt = editFormState
    ? buildLiveTrainingStageDateTime(editFormState.endDate, editFormState.endTime)
    : liveTraining.endsAt;

  const updateAndCommit = <Key extends keyof LiveTrainingEditFormState>(
    key: Key,
    value: LiveTrainingEditFormState[Key],
  ) => {
    if (!editFormState) return;

    const nextFormState = { ...editFormState, [key]: value };
    onEditFormStateChange(key, value);
    onEditFormStateCommit(nextFormState);
  };

  const commitCurrentFormState = () => {
    if (!editFormState) return;

    onEditFormStateCommit(editFormState);
  };

  const handleTitleBlur = () => {
    setIsTitleFocused(false);
    commitCurrentFormState();
  };

  const handleDescriptionBlur = () => {
    setIsDescriptionFocused(false);
    commitCurrentFormState();
  };

  const toggleDeliveryType = () => {
    updateAndCommit(
      "deliveryType",
      isOffline ? LIVE_TRAINING_DELIVERY_TYPES.ONLINE : LIVE_TRAINING_DELIVERY_TYPES.OFFLINE,
    );
  };

  const handleMaxParticipantsChange = (value: string) => {
    if (!value) {
      onEditFormStateChange("maxParticipants", value);
      return;
    }

    const numericValue = Number(value);

    if (Number.isNaN(numericValue)) return;

    onEditFormStateChange("maxParticipants", String(Math.min(numericValue, 100)));
  };

  const handleDescriptionChange = (value: string) => {
    onEditFormStateChange("description", limitLiveTrainingDescription(value));
  };

  const handleTitleChange = (value: string) => {
    onEditFormStateChange("title", limitLiveTrainingTitle(value));
  };

  useEffect(() => {
    const titleElement = titleRef.current;

    if (!titleElement) return;

    resizeLiveTrainingTextArea(titleElement, LIVE_TRAINING_TITLE_MAX_HEIGHT);
  }, [titleValue]);

  useEffect(() => {
    const descriptionElement = descriptionRef.current;

    if (!descriptionElement) return;

    resizeLiveTrainingTextArea(descriptionElement, LIVE_TRAINING_DESCRIPTION_MAX_HEIGHT);
  }, [displayedDescription]);

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

                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={toggleDeliveryType}
                  className="group rounded focus-visible:outline-none"
                >
                  <PreviewMetaItem
                    canEdit={canEdit}
                    value={t(`liveTrainingView.deliveryType.${displayedDeliveryType}`)}
                    tooltip={t("calendarView.create.tooltip.deliveryType")}
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
                          value={formatLiveTrainingDateRange(displayedStartsAt, displayedEndsAt)}
                          tooltip={t("liveTrainingView.stage.scheduleTooltip")}
                        />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="grid w-[min(92vw,32rem)] gap-4 p-4">
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
                    </PopoverContent>
                  </Popover>
                )}

                {editFormState && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex h-8 max-w-[78vw] shrink-0 items-center gap-2 rounded border border-white/15 bg-white/10 px-2.5 text-xs text-white/85 transition-colors hover:border-dotted hover:border-white/60 focus-within:border-solid focus-within:border-white/75 sm:h-9 sm:max-w-none sm:px-3 sm:text-sm">
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
                      <span className="inline-flex h-8 max-w-[78vw] shrink-0 items-center rounded border border-white/15 bg-white/10 px-2.5 text-xs text-white/85 transition-colors hover:border-dotted hover:border-white/60 focus-within:border-solid focus-within:border-white/75 sm:h-9 sm:max-w-none sm:px-3 sm:text-sm">
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
                        icon={<Mic className="size-4" />}
                        value={
                          editFormState.microphoneEnabled
                            ? t("liveTrainingView.boolean.yes")
                            : t("liveTrainingView.boolean.no")
                        }
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
                        icon={<Video className="size-4" />}
                        value={
                          editFormState.cameraEnabled
                            ? t("liveTrainingView.boolean.yes")
                            : t("liveTrainingView.boolean.no")
                        }
                        tooltip={t("liveTrainingView.stage.viewerCamera")}
                      />
                    </button>
                  </>
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
