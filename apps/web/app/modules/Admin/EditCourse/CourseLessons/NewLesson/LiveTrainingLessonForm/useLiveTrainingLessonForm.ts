import { zodResolver } from "@hookform/resolvers/zod";
import { LIVE_TRAINING_DELIVERY_TYPES, LIVE_TRAINING_STATUSES, PERMISSIONS } from "@repo/shared";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useAttachLiveTrainingLesson } from "~/api/mutations/admin/useAttachLiveTrainingLesson";
import { useCreateLiveTrainingLesson } from "~/api/mutations/admin/useCreateLiveTrainingLesson";
import { useUpdateLiveTrainingLessonTitle } from "~/api/mutations/admin/useUpdateLiveTrainingLessonTitle";
import { useLiveTrainings } from "~/api/queries/live-training/useLiveTrainings";
import { useLiveKitConfigured } from "~/api/queries/useLiveKitConfigured";
import { useLeaveModal } from "~/context/LeaveModalContext";
import { usePermissions } from "~/hooks/usePermissions";
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
  LiveTrainingFormFieldErrors,
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
  const { data: liveKitConfigured } = useLiveKitConfigured();
  const { hasAccess: canCreateLiveTraining } = usePermissions({
    required: PERMISSIONS.LIVE_TRAINING_CREATE,
  });
  const isOnlineDeliveryAvailable = Boolean(liveKitConfigured?.enabled);
  const [formMode, setFormMode] = useState<LiveTrainingLessonFormMode>(
    canCreateLiveTraining
      ? LIVE_TRAINING_LESSON_FORM_MODES.CREATE_NEW
      : LIVE_TRAINING_LESSON_FORM_MODES.LINK_EXISTING,
  );
  const [selectedLiveTrainingId, setSelectedLiveTrainingId] = useState<string | null>(null);
  const [liveTrainingFormState, setLiveTrainingFormState] = useState<LiveTrainingFormState>(() =>
    buildInitialCalendarCreateLiveTrainingFormState(null, LIVE_TRAINING_DELIVERY_TYPES.OFFLINE),
  );
  const [liveTrainingFormError, setLiveTrainingFormError] = useState<string | null>(null);
  const [liveTrainingFormFieldErrors, setLiveTrainingFormFieldErrors] =
    useState<LiveTrainingFormFieldErrors>({});
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
    if (!canCreateLiveTraining && formMode === LIVE_TRAINING_LESSON_FORM_MODES.CREATE_NEW) {
      setFormMode(LIVE_TRAINING_LESSON_FORM_MODES.LINK_EXISTING);
      setLiveTrainingFormError(null);
      return;
    }

    const hasAssignmentDraft =
      shouldShowAssignmentFields &&
      (isLiveTrainingFormDirty ||
        formMode !== LIVE_TRAINING_LESSON_FORM_MODES.CREATE_NEW ||
        Boolean(selectedLiveTrainingId));

    setIsCurrectFormDirty(isDirty || hasAssignmentDraft);
  }, [
    canCreateLiveTraining,
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

  useEffect(() => {
    if (isOnlineDeliveryAvailable && !isLiveTrainingFormDirty) {
      setLiveTrainingFormState((current) => ({
        ...current,
        deliveryType: LIVE_TRAINING_DELIVERY_TYPES.ONLINE,
      }));
      return;
    }

    if (isOnlineDeliveryAvailable) return;

    setLiveTrainingFormState((current) => {
      if (current.deliveryType === LIVE_TRAINING_DELIVERY_TYPES.OFFLINE) return current;

      return { ...current, deliveryType: LIVE_TRAINING_DELIVERY_TYPES.OFFLINE };
    });
  }, [isLiveTrainingFormDirty, isOnlineDeliveryAvailable]);

  const updateFormMode = (mode: LiveTrainingLessonFormMode) => {
    setFormMode(mode);
    setLiveTrainingFormError(null);
    setLiveTrainingFormFieldErrors({});
  };

  const updateLiveTrainingFormState: LiveTrainingFormFieldUpdater = (key, value) => {
    setLiveTrainingFormState((current) => ({ ...current, [key]: value }));
    setLiveTrainingFormFieldErrors((current) => {
      if (key === "title" && current.title) return { ...current, title: undefined };

      if (
        (key === "startDate" || key === "startTime" || key === "endDate" || key === "endTime") &&
        current.endsAt
      ) {
        return { ...current, endsAt: undefined };
      }

      return current;
    });
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
    const isLinkExistingMode =
      !canCreateLiveTraining || formMode === LIVE_TRAINING_LESSON_FORM_MODES.LINK_EXISTING;
    const { startsAt, endsAt } = getLiveTrainingDates();

    if (isLinkExistingMode && !selectedLiveTrainingId) {
      setLiveTrainingFormFieldErrors({});
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
        const fieldErrors = validationResult.error.issues.reduce<LiveTrainingFormFieldErrors>(
          (errors, issue) => {
            const field = issue.path[0];

            if (field === "title") return { ...errors, title: issue.message };
            if (field === "endsAt") return { ...errors, endsAt: issue.message };

            return errors;
          },
          {},
        );

        setLiveTrainingFormFieldErrors(fieldErrors);
        setLiveTrainingFormError(
          Object.keys(fieldErrors).length ? null : t("common.toast.somethingWentWrong"),
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
    setLiveTrainingFormFieldErrors({});

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
      setLiveTrainingFormFieldErrors({});

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
    if (
      (!canCreateLiveTraining || formMode === LIVE_TRAINING_LESSON_FORM_MODES.LINK_EXISTING) &&
      selectedLiveTrainingId
    ) {
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
    canCreateLiveTraining,
    currentLanguageHasLiveTraining,
    form,
    formMode,
    isPending: isPending || isUpdatingTitle || isAttachingLiveTraining,
    isLoadingScheduledLiveTrainings,
    isOnlineDeliveryAvailable,
    liveTrainingFormFieldErrors,
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
