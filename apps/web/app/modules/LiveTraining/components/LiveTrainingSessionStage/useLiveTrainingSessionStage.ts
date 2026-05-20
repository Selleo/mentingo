import {
  LIVE_TRAINING_DELIVERY_TYPES,
  LIVE_TRAINING_DESCRIPTION_MAX_LENGTH,
  LIVE_TRAINING_STATUSES,
  LIVE_TRAINING_TITLE_MAX_LENGTH,
} from "@repo/shared";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  LIVE_TRAINING_DESCRIPTION_MAX_HEIGHT,
  LIVE_TRAINING_TITLE_MAX_HEIGHT,
} from "~/modules/LiveTraining/components/LiveTrainingSessionStage/LiveTrainingSessionStage.constants";
import {
  buildLiveTrainingStageAllDayEndDateTime,
  buildLiveTrainingStageDateTime,
  limitLiveTrainingDescription,
  limitLiveTrainingTitle,
  resizeLiveTrainingTextArea,
  trimLiveTrainingDescriptionForPreview,
} from "~/modules/LiveTraining/components/LiveTrainingSessionStage/LiveTrainingSessionStage.utils";

import type { LiveTrainingSessionStageLogicParams } from "./LiveTrainingSessionStage.types";
import type { LiveTrainingEditFormState } from "~/modules/LiveTraining/liveTrainingEdit.types";

export function useLiveTrainingSessionStage({
  liveTraining,
  actions,
  editFormState,
  onEditFormStateChange,
  onEditFormStateCommit,
}: LiveTrainingSessionStageLogicParams) {
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const [isDescriptionFocused, setIsDescriptionFocused] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const canEdit = actions.canShowEdit && Boolean(editFormState);
  const displayedDeliveryType = editFormState?.deliveryType ?? liveTraining.deliveryType;
  const displayedAllDay = editFormState?.allDay ?? liveTraining.allDay;
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
    ? buildLiveTrainingStageDateTime(
        editFormState.startDate,
        displayedAllDay ? "00:00" : editFormState.startTime,
      )
    : liveTraining.startsAt;
  const displayedEndsAt = editFormState
    ? displayedAllDay
      ? buildLiveTrainingStageAllDayEndDateTime(editFormState.endDate)
      : buildLiveTrainingStageDateTime(editFormState.endDate, editFormState.endTime)
    : liveTraining.endsAt;

  const commitCurrentFormState = useCallback(() => {
    if (!editFormState) return;

    onEditFormStateCommit(editFormState);
  }, [editFormState, onEditFormStateCommit]);

  const updateAndCommit = useCallback(
    <Key extends keyof LiveTrainingEditFormState>(
      key: Key,
      value: LiveTrainingEditFormState[Key],
    ) => {
      if (!editFormState) return;

      const nextFormState = { ...editFormState, [key]: value };
      onEditFormStateChange(key, value);
      onEditFormStateCommit(nextFormState);
    },
    [editFormState, onEditFormStateChange, onEditFormStateCommit],
  );

  const handleTitleBlur = useCallback(() => {
    setIsTitleFocused(false);
    commitCurrentFormState();
  }, [commitCurrentFormState]);

  const handleDescriptionBlur = useCallback(() => {
    setIsDescriptionFocused(false);
    commitCurrentFormState();
  }, [commitCurrentFormState]);

  const toggleDeliveryType = useCallback(() => {
    updateAndCommit(
      "deliveryType",
      isOffline ? LIVE_TRAINING_DELIVERY_TYPES.ONLINE : LIVE_TRAINING_DELIVERY_TYPES.OFFLINE,
    );
  }, [isOffline, updateAndCommit]);

  const handleMaxParticipantsChange = useCallback(
    (value: string) => {
      if (!value) {
        onEditFormStateChange("maxParticipants", value);
        return;
      }

      const numericValue = Number(value);

      if (Number.isNaN(numericValue)) return;

      onEditFormStateChange("maxParticipants", String(Math.min(numericValue, 100)));
    },
    [onEditFormStateChange],
  );

  const handleDescriptionChange = useCallback(
    (value: string) => {
      onEditFormStateChange("description", limitLiveTrainingDescription(value));
    },
    [onEditFormStateChange],
  );

  const handleTitleChange = useCallback(
    (value: string) => {
      onEditFormStateChange("title", limitLiveTrainingTitle(value));
    },
    [onEditFormStateChange],
  );

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

  return {
    canEdit,
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
    isTitleAtLimit,
    isTitleFocused,
    setIsDescriptionFocused,
    setIsTitleFocused,
    shouldShowDescription,
    titleRef,
    titleValue,
    toggleDeliveryType,
    updateAndCommit,
    commitCurrentFormState,
  };
}
