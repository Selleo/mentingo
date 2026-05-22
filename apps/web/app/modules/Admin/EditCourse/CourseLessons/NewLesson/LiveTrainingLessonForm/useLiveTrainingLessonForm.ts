import { zodResolver } from "@hookform/resolvers/zod";
import { LIVE_TRAINING_DELIVERY_TYPES, LIVE_TRAINING_STATUSES } from "@repo/shared";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useAttachLiveTrainingLesson } from "~/api/mutations/admin/useAttachLiveTrainingLesson";
import { useCreateLiveTrainingLesson } from "~/api/mutations/admin/useCreateLiveTrainingLesson";
import { useUpdateLiveTrainingLessonTitle } from "~/api/mutations/admin/useUpdateLiveTrainingLessonTitle";
import { useLiveTrainings } from "~/api/queries/live-training/useLiveTrainings";
import { useLeaveModal } from "~/context/LeaveModalContext";
import { getCalendarCreateLiveTrainingSchema } from "~/modules/Calendar/components/calendarCreateLiveTraining.schema";
import {
  buildCalendarCreateAllDayEndDateTime,
  buildCalendarCreateAllDayStartDateTime,
  buildCalendarCreateDateTime,
  buildInitialCalendarCreateLiveTrainingFormState,
} from "~/modules/Calendar/components/calendarCreateLiveTraining.utils";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { ContentTypes } from "../../../EditCourse.types";

import { liveTrainingLessonFormSchema } from "./liveTrainingLessonForm.schema";
import { LIVE_TRAINING_LESSON_FORM_MODES } from "./liveTrainingLessonForm.types";

import type { LiveTrainingLessonFormValues } from "./liveTrainingLessonForm.schema";
import type { LiveTrainingLessonFormMode } from "./liveTrainingLessonForm.types";
import type { Chapter, Lesson } from "../../../EditCourse.types";
import type { SupportedLanguages } from "@repo/shared";
import type {
  LiveTrainingFormFieldUpdater,
  LiveTrainingFormState,
} from "~/modules/LiveTraining/liveTrainingForm.types";

type UseLiveTrainingLessonFormOptions = {
  chapterToEdit: Chapter | null;
  language: SupportedLanguages;
  lessonToEdit: Lesson | null;
  setContentTypeToDisplay: (contentTypeToDisplay: string) => void;
};

export function useLiveTrainingLessonForm({
  chapterToEdit,
  language,
  lessonToEdit,
  setContentTypeToDisplay,
}: UseLiveTrainingLessonFormOptions) {
  const { t } = useTranslation();
  const { setIsCurrectFormDirty } = useLeaveModal();
  const uiLanguage = useLanguageStore((state) => state.language);
  const { mutateAsync: createLiveTrainingLesson, isPending } = useCreateLiveTrainingLesson();
  const { mutateAsync: attachLiveTrainingLesson, isPending: isAttachingLiveTraining } =
    useAttachLiveTrainingLesson();
  const { mutateAsync: updateLiveTrainingLessonTitle, isPending: isUpdatingTitle } =
    useUpdateLiveTrainingLessonTitle();
  const [formMode, setFormMode] = useState<LiveTrainingLessonFormMode>(
    LIVE_TRAINING_LESSON_FORM_MODES.CREATE_NEW,
  );
  const [selectedLiveTrainingId, setSelectedLiveTrainingId] = useState<string | null>(null);
  const [liveTrainingFormState, setLiveTrainingFormState] = useState<LiveTrainingFormState>(() =>
    buildInitialCalendarCreateLiveTrainingFormState(null),
  );
  const [liveTrainingFormError, setLiveTrainingFormError] = useState<string | null>(null);
  const [isLiveTrainingFormDirty, setIsLiveTrainingFormDirty] = useState(false);

  const form = useForm<LiveTrainingLessonFormValues>({
    resolver: zodResolver(liveTrainingLessonFormSchema(t)),
    mode: "onChange",
    defaultValues: {
      title: lessonToEdit?.title ?? "",
    },
  });

  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", []);
  const { isDirty } = form.formState;
  const { reset } = form;
  const currentLanguageHasLiveTraining =
    !lessonToEdit || Boolean(lessonToEdit.liveTrainingLanguages?.includes(language));
  const shouldShowAssignmentFields = !lessonToEdit || !currentLanguageHasLiveTraining;
  const { data: scheduledLiveTrainings, isLoading: isLoadingScheduledLiveTrainings } =
    useLiveTrainings({
      status: LIVE_TRAINING_STATUSES.SCHEDULED,
      language: uiLanguage,
      enabled:
        shouldShowAssignmentFields && formMode === LIVE_TRAINING_LESSON_FORM_MODES.LINK_EXISTING,
      perPage: 50,
    });

  useEffect(() => {
    const hasAssignmentDraft =
      shouldShowAssignmentFields &&
      (isLiveTrainingFormDirty ||
        formMode !== LIVE_TRAINING_LESSON_FORM_MODES.CREATE_NEW ||
        Boolean(selectedLiveTrainingId));

    setIsCurrectFormDirty(isDirty || hasAssignmentDraft);
  }, [
    formMode,
    isDirty,
    isLiveTrainingFormDirty,
    selectedLiveTrainingId,
    setIsCurrectFormDirty,
    shouldShowAssignmentFields,
  ]);

  useEffect(() => {
    reset({ title: lessonToEdit?.title ?? "" });
  }, [lessonToEdit, reset]);

  const updateFormMode = (mode: LiveTrainingLessonFormMode) => {
    setFormMode(mode);
    setLiveTrainingFormError(null);
  };

  const updateLiveTrainingFormState: LiveTrainingFormFieldUpdater = (key, value) => {
    setLiveTrainingFormState((current) => ({ ...current, [key]: value }));
    setIsLiveTrainingFormDirty(true);
  };

  const getLiveTrainingDates = () => {
    const startsAt = liveTrainingFormState.allDay
      ? buildCalendarCreateAllDayStartDateTime(liveTrainingFormState.startDate)
      : buildCalendarCreateDateTime(
          liveTrainingFormState.startDate,
          liveTrainingFormState.startTime,
        );
    const endsAt = liveTrainingFormState.allDay
      ? buildCalendarCreateAllDayEndDateTime(liveTrainingFormState.endDate)
      : buildCalendarCreateDateTime(liveTrainingFormState.endDate, liveTrainingFormState.endTime);

    return { startsAt, endsAt };
  };

  const validateLiveTrainingAssignment = () => {
    const isLinkExistingMode = formMode === LIVE_TRAINING_LESSON_FORM_MODES.LINK_EXISTING;
    const { startsAt, endsAt } = getLiveTrainingDates();

    if (isLinkExistingMode && !selectedLiveTrainingId) {
      setLiveTrainingFormError(
        t("adminCourseView.curriculum.lesson.liveTraining.validation.liveTrainingRequired"),
      );
      return null;
    }

    if (!isLinkExistingMode) {
      const validationResult = getCalendarCreateLiveTrainingSchema(t).safeParse({
        title: liveTrainingFormState.title,
        startsAt,
        endsAt,
      });

      if (!validationResult.success) {
        setLiveTrainingFormError(
          validationResult.error.issues[0]?.message ?? t("common.toast.somethingWentWrong"),
        );
        return null;
      }
    }

    return getLiveTrainingLessonPayload(startsAt, endsAt);
  };

  const onSubmit = async (values: LiveTrainingLessonFormValues) => {
    if (!chapterToEdit || lessonToEdit) return;

    const liveTrainingPayload = validateLiveTrainingAssignment();

    if (!liveTrainingPayload) return;

    setLiveTrainingFormError(null);

    await createLiveTrainingLesson({
      data: {
        title: values.title.trim(),
        chapterId: chapterToEdit.id,
        language,
        ...liveTrainingPayload,
      },
    });

    setIsCurrectFormDirty(false);
    setContentTypeToDisplay(ContentTypes.EMPTY);
  };

  const onSubmitEdit = async (values: LiveTrainingLessonFormValues) => {
    if (!lessonToEdit) return;

    if (!currentLanguageHasLiveTraining) {
      const liveTrainingPayload = validateLiveTrainingAssignment();

      if (!liveTrainingPayload) return;

      setLiveTrainingFormError(null);

      await attachLiveTrainingLesson({
        lessonId: lessonToEdit.id,
        data: {
          title: values.title.trim(),
          language,
          ...liveTrainingPayload,
        },
      });

      setIsCurrectFormDirty(false);
      setContentTypeToDisplay(ContentTypes.EMPTY);
      return;
    }

    await updateLiveTrainingLessonTitle({
      lessonId: lessonToEdit.id,
      title: values.title.trim(),
      language,
    });

    setIsCurrectFormDirty(false);
    setContentTypeToDisplay(ContentTypes.EMPTY);
  };

  const getLiveTrainingLessonPayload = (startsAt: Date, endsAt: Date) => {
    if (formMode === LIVE_TRAINING_LESSON_FORM_MODES.LINK_EXISTING && selectedLiveTrainingId) {
      return { liveTrainingId: selectedLiveTrainingId };
    }

    const location = liveTrainingFormState.location.trim();
    const shouldSaveLocation =
      liveTrainingFormState.deliveryType === LIVE_TRAINING_DELIVERY_TYPES.OFFLINE && location;

    return {
      liveTraining: {
        title: liveTrainingFormState.title.trim(),
        description: liveTrainingFormState.description.trim() || null,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        allDay: liveTrainingFormState.allDay,
        timezone,
        deliveryType: liveTrainingFormState.deliveryType,
        location: shouldSaveLocation ? location : null,
        maxParticipants: liveTrainingFormState.maxParticipants,
        settings: {
          viewerPermissions: {
            microphoneEnabled: liveTrainingFormState.microphoneEnabled,
            cameraEnabled: liveTrainingFormState.cameraEnabled,
          },
        },
      },
    };
  };

  return {
    currentLanguageHasLiveTraining,
    form,
    formMode,
    isPending: isPending || isUpdatingTitle || isAttachingLiveTraining,
    isLoadingScheduledLiveTrainings,
    liveTrainingFormError,
    liveTrainingFormState,
    onSubmit,
    onSubmitEdit,
    scheduledLiveTrainings: scheduledLiveTrainings ?? [],
    selectedLiveTrainingId,
    setSelectedLiveTrainingId,
    updateFormMode,
    updateLiveTrainingFormState,
  };
}
