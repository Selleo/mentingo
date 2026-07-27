import { useParams } from "@remix-run/react";
import { AI_JUDGE_GENERATION_MAX_ATTEMPTS, ALLOWED_EXTENSIONS } from "@repo/shared";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useReplaceAiJudgeConfiguration } from "~/api/mutations/admin/useReplaceAiJudgeConfiguration";
import { useUpdateAiJudgeConfigurationTranslation } from "~/api/mutations/admin/useUpdateAiJudgeConfigurationTranslation";
import { useUploadAiMentorAvatar } from "~/api/mutations/admin/useUploadAiMentorAvatar";
import { useValidateAiJudgeConfiguration } from "~/api/mutations/admin/useValidateAiJudgeConfiguration";
import { useAiJudgeConfiguration } from "~/api/queries/admin/useAiJudgeConfiguration";
import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";
import { useLumaConfigured } from "~/api/queries/useLumaConfigured";
import { queryClient } from "~/api/queryClient";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Form } from "~/components/ui/form";
import { TooltipProvider } from "~/components/ui/tooltip";
import DeleteConfirmationModal from "~/modules/Admin/components/DeleteConfirmationModal";
import { MissingTranslationsAlert } from "~/modules/Admin/EditCourse/components/MissingTranslationsAlert";
import { MultiFileUploadForm } from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/AiMentorLessonForm/components/MultiFileUploadForm";
import AiMentorLessonPreview from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/AiMentorLessonForm/hooks/AiMentorLessonPreview";

import { AI_MENTOR_LESSON_FORM_HANDLES } from "../../../../../../../e2e/data/curriculum/handles";
import { DeleteContentType } from "../../../EditCourse.types";
import Breadcrumb from "../components/Breadcrumb";

import {
  AI_JUDGE_AUTHORING_ACTION,
  AI_JUDGE_AUTHORING_VIEW,
  aiJudgeAuthoringReducer,
  getAiJudgeGenerationMode,
  getLatestAiJudgeValidation,
  INITIAL_AI_JUDGE_AUTHORING_STATE,
} from "./AiJudge/aiJudgeAuthoring.reducer";
import {
  mapAiJudgeConfigurationDraftToBaseInput,
  mapAiJudgeConfigurationDraftToTranslationInput,
  mapAiJudgeConfigurationResponseToDraft,
} from "./AiJudge/aiJudgeConfiguration.mappers";
import {
  AI_JUDGE_GENERATION_MODE,
  AI_JUDGE_GENERATION_STATUS,
} from "./AiJudge/aiJudgeConfiguration.types";
import { AiJudgeConfigurationCard } from "./AiJudge/AiJudgeConfigurationCard";
import { AiJudgeGenerationDialog } from "./AiJudge/AiJudgeGenerationDialog";
import { useAiJudgeConfigurationGeneration } from "./AiJudge/useAiJudgeConfigurationGeneration";
import { AiMentorIdentityFields } from "./components/AiMentorIdentityFields";
import {
  AiMentorInstructionsField,
  AiMentorSuggestionExamples,
} from "./components/AiMentorInstructionsFields";
import { AiMentorScenarioFields } from "./components/AiMentorScenarioFields";
import { AiMentorVoiceConfigurationFields } from "./components/AiMentorVoiceConfigurationFields";
import { useAiMentorLessonForm } from "./hooks/useAiMentorLessonForm";
import UpdateAiAvatarModal from "./UpdateAiAvatarModal";

import type {
  AiJudgeConfigurationDraft,
  AiJudgeGenerationMode,
  AiJudgeGenerationRequest,
  AiJudgeValidationResult,
} from "./AiJudge/aiJudgeConfiguration.types";
import type { Chapter, Lesson } from "../../../EditCourse.types";
import type { SupportedLanguages } from "@repo/shared";

type AiMentorLessonProps = {
  setContentTypeToDisplay: (contentTypeToDisplay: string) => void;
  chapterToEdit: Chapter | null;
  lessonToEdit: Lesson | null;
  setSelectedLesson: (selectedLesson: Lesson | null) => void;
  language: SupportedLanguages;
  baseLanguage: SupportedLanguages;
};

const AiMentorLessonForm = ({
  setContentTypeToDisplay,
  chapterToEdit,
  lessonToEdit,
  setSelectedLesson,
  language,
  baseLanguage,
}: AiMentorLessonProps) => {
  const { mutateAsync: replaceAiJudgeConfiguration, isPending: isReplacingAiJudgeConfiguration } =
    useReplaceAiJudgeConfiguration();
  const saveStagedAiJudgeConfiguration = async (configuration: AiJudgeConfigurationDraft) => {
    if (!lessonToEdit) return;

    await replaceAiJudgeConfiguration({
      lessonId: lessonToEdit.id,
      language: baseLanguage,
      data: mapAiJudgeConfigurationDraftToBaseInput(configuration),
    });
  };

  const {
    form,
    onSubmit,
    onDelete,
    handleSuggestionClick,
    isConfirmDialogOpen,
    setIsConfirmDialogOpen,
    onConfirmOverwrite,
    onCancelOverwrite,
  } = useAiMentorLessonForm({
    chapterToEdit,
    lessonToEdit,
    setContentTypeToDisplay,
    language,
    baseLanguage,
    onSaveStagedAiJudgeConfiguration: saveStagedAiJudgeConfiguration,
  });

  const { t } = useTranslation();

  const { id = "" } = useParams();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAvatarDialogOpen, setIsAvatarDialogOpen] = useState(false);
  const [aiJudgeAuthoringState, dispatchAiJudgeAuthoring] = useReducer(
    aiJudgeAuthoringReducer,
    INITIAL_AI_JUDGE_AUTHORING_STATE,
  );
  const aiJudgeGenerationMode = getAiJudgeGenerationMode(aiJudgeAuthoringState);
  const latestAiJudgeValidation = getLatestAiJudgeValidation(aiJudgeAuthoringState);
  const isAiJudgeEditorOpen = aiJudgeAuthoringState.view === AI_JUDGE_AUTHORING_VIEW.EDITOR;
  const isAiJudgeGenerationDialogOpen =
    aiJudgeAuthoringState.view === AI_JUDGE_AUTHORING_VIEW.GENERATION;
  const [previewOpen, setPreviewOpen] = useState(false);
  const {
    state: aiJudgeGenerationState,
    startGeneration: startAiJudgeConfigurationGeneration,
    cancelGeneration: cancelAiJudgeConfigurationGeneration,
    reviseGeneration: reviseAiJudgeConfigurationGeneration,
    resetGeneration: resetAiJudgeConfigurationGeneration,
    isStarting: isStartingAiJudgeConfigurationGeneration,
    isRevising: isRevisingAiJudgeConfigurationGeneration,
  } = useAiJudgeConfigurationGeneration();
  const { mutateAsync: validateAiJudgeConfiguration, isPending: isValidatingAiJudgeConfiguration } =
    useValidateAiJudgeConfiguration();
  const { mutateAsync: uploadAvatar } = useUploadAiMentorAvatar();
  const {
    mutateAsync: updateAiJudgeConfigurationTranslation,
    isPending: isUpdatingAiJudgeConfigurationTranslation,
  } = useUpdateAiJudgeConfigurationTranslation();
  const lessonId = lessonToEdit?.id ?? "";
  const { data: savedAiJudgeConfiguration, isLoading: isAiJudgeConfigurationLoading } =
    useAiJudgeConfiguration(lessonId, language);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    lessonToEdit?.avatarReferenceUrl ?? null,
  );
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const { data: lumaConfigured } = useLumaConfigured();
  const canConfigureVoiceMentor = Boolean(lumaConfigured?.voiceMentorEnabled);
  const voiceConfigTooltipKey =
    lumaConfigured?.voiceTtsProvider === "openaiCompatible"
      ? "adminCourseView.curriculum.lesson.other.voiceConfigOpenAiCompatibleTooltip"
      : "adminCourseView.curriculum.lesson.other.voiceConfigCartesiaTooltip";

  const objectUrlRef = useRef<string | null>(null);
  const hasStagedAiJudgeConfigurationRef = useRef(false);
  const stagedAiJudgeConfiguration = form.watch("aiJudgeConfiguration");
  const persistedAiJudgeConfiguration = useMemo(
    () =>
      savedAiJudgeConfiguration
        ? mapAiJudgeConfigurationResponseToDraft(savedAiJudgeConfiguration)
        : undefined,
    [savedAiJudgeConfiguration],
  );
  const aiJudgeConfiguration = stagedAiJudgeConfiguration ?? persistedAiJudgeConfiguration;
  const isAiJudgeConfigurationDirty = Boolean(form.formState.dirtyFields.aiJudgeConfiguration);

  useEffect(() => {
    hasStagedAiJudgeConfigurationRef.current = false;
  }, [language, lessonToEdit?.id]);

  useEffect(() => {
    if (
      !lessonToEdit ||
      !persistedAiJudgeConfiguration ||
      isAiJudgeConfigurationDirty ||
      hasStagedAiJudgeConfigurationRef.current
    )
      return;

    form.setValue("aiJudgeConfiguration", persistedAiJudgeConfiguration, {
      shouldDirty: false,
      shouldValidate: false,
    });
  }, [form, isAiJudgeConfigurationDirty, lessonToEdit, persistedAiJudgeConfiguration]);

  const hasMissingTranslations = Boolean(
    lessonToEdit &&
      language !== baseLanguage &&
      (!lessonToEdit.title.trim() ||
        !lessonToEdit.aiMentor?.aiMentorInstructions.trim() ||
        savedAiJudgeConfiguration?.hasMissingTranslations),
  );

  const handleAiJudgeBaseConfigurationSave = async (
    configuration: NonNullable<typeof aiJudgeConfiguration>,
  ) => {
    if (lessonToEdit) {
      await saveStagedAiJudgeConfiguration(configuration);
      hasStagedAiJudgeConfigurationRef.current = false;
      form.resetField("aiJudgeConfiguration", { defaultValue: configuration });
      return;
    }

    hasStagedAiJudgeConfigurationRef.current = true;
    form.setValue("aiJudgeConfiguration", configuration, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const handleAiJudgeTranslationSave = async (
    configuration: NonNullable<typeof aiJudgeConfiguration>,
  ) => {
    if (!lessonToEdit) return;

    await updateAiJudgeConfigurationTranslation({
      courseId: id,
      lessonId: lessonToEdit.id,
      language,
      data: mapAiJudgeConfigurationDraftToTranslationInput(configuration),
    });
  };

  const openAiJudgeGeneration = (
    mode: AiJudgeGenerationMode,
    validation?: AiJudgeValidationResult,
  ) => {
    resetAiJudgeConfigurationGeneration();
    if (mode === AI_JUDGE_GENERATION_MODE.CREATE) {
      dispatchAiJudgeAuthoring({ type: AI_JUDGE_AUTHORING_ACTION.OPEN_CREATE });
      return;
    }

    dispatchAiJudgeAuthoring({
      type: AI_JUDGE_AUTHORING_ACTION.OPEN_IMPROVE,
      latestValidation: validation,
    });
  };

  const handleConfigureAiJudgeWithAi = (mode: AiJudgeGenerationMode) => {
    openAiJudgeGeneration(mode);
  };

  const getAiJudgeLessonContext = () => ({
    title: form.getValues("title") || undefined,
    taskDescription: form.getValues("description") || undefined,
    aiMentorInstructions: form.getValues("aiMentorInstructions") || undefined,
    aiMentorType: form.getValues("type"),
  });

  const handleGenerateAiJudgeConfiguration = async ({
    mode,
    instruction,
  }: AiJudgeGenerationRequest) => {
    const commonInput = {
      courseId: id,
      lessonId: lessonToEdit?.id,
      lessonContext: getAiJudgeLessonContext(),
    };

    if (mode === AI_JUDGE_GENERATION_MODE.CREATE) {
      await startAiJudgeConfigurationGeneration({
        ...commonInput,
        mode: AI_JUDGE_GENERATION_MODE.CREATE,
        brief: instruction,
      });
      return;
    }

    if (!aiJudgeConfiguration) return;

    await startAiJudgeConfigurationGeneration({
      ...commonInput,
      mode: AI_JUDGE_GENERATION_MODE.IMPROVE,
      instruction,
      currentConfiguration: mapAiJudgeConfigurationDraftToBaseInput(aiJudgeConfiguration),
      latestValidation: latestAiJudgeValidation,
    });
  };

  const handleValidateAiJudgeConfiguration = (
    configuration: AiJudgeConfigurationDraft,
    signal?: AbortSignal,
  ) =>
    validateAiJudgeConfiguration({
      data: {
        courseId: id,
        lessonId: lessonToEdit?.id,
        lessonContext: getAiJudgeLessonContext(),
        configuration: mapAiJudgeConfigurationDraftToBaseInput(configuration),
      },
      signal,
    });

  const stageGeneratedAiJudgeConfiguration = (configuration: AiJudgeConfigurationDraft) => {
    hasStagedAiJudgeConfigurationRef.current = true;
    form.setValue("aiJudgeConfiguration", configuration, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const handleImproveAiJudgeConfigurationAfterValidation = (
    configuration: AiJudgeConfigurationDraft,
    validation?: AiJudgeValidationResult,
  ) => {
    stageGeneratedAiJudgeConfiguration(configuration);
    openAiJudgeGeneration(AI_JUDGE_GENERATION_MODE.IMPROVE, validation);

    if (!validation) return;

    const instruction = validation.issues.map(({ correction }) => correction).join("\n\n");
    void startAiJudgeConfigurationGeneration({
      courseId: id,
      lessonId: lessonToEdit?.id,
      lessonContext: getAiJudgeLessonContext(),
      mode: AI_JUDGE_GENERATION_MODE.IMPROVE,
      instruction: instruction || validation.summary,
      currentConfiguration: mapAiJudgeConfigurationDraftToBaseInput(configuration),
      latestValidation: validation,
    }).catch(() => {
      dispatchAiJudgeAuthoring({ type: AI_JUDGE_AUTHORING_ACTION.OPEN_EDITOR });
    });
  };

  const visibleAiJudgeGenerationState =
    aiJudgeGenerationState ??
    (isStartingAiJudgeConfigurationGeneration || latestAiJudgeValidation
      ? {
          status: AI_JUDGE_GENERATION_STATUS.DRAFTING,
          attempt: 1,
          maxAttempts: AI_JUDGE_GENERATION_MAX_ATTEMPTS,
          completedArtifacts: [],
          evaluatorChecks: [],
          changes: [],
          attemptHistory: [],
        }
      : undefined);

  const handleEditGeneratedAiJudgeConfiguration = (configuration: AiJudgeConfigurationDraft) => {
    stageGeneratedAiJudgeConfiguration(configuration);
    resetAiJudgeConfigurationGeneration();
    dispatchAiJudgeAuthoring({ type: AI_JUDGE_AUTHORING_ACTION.OPEN_EDITOR });
  };

  const handleStopAndInspectAiJudgeConfiguration = async () => {
    if (!aiJudgeGenerationState?.draft) return;

    stageGeneratedAiJudgeConfiguration(aiJudgeGenerationState.draft);
    await cancelAiJudgeConfigurationGeneration();
    resetAiJudgeConfigurationGeneration();
    dispatchAiJudgeAuthoring({ type: AI_JUDGE_AUTHORING_ACTION.OPEN_EDITOR });
  };

  const handleCancelAiJudgeConfigurationGeneration = async () => {
    await cancelAiJudgeConfigurationGeneration();
    resetAiJudgeConfigurationGeneration();
    dispatchAiJudgeAuthoring({
      type:
        aiJudgeGenerationMode === AI_JUDGE_GENERATION_MODE.IMPROVE
          ? AI_JUDGE_AUTHORING_ACTION.OPEN_EDITOR
          : AI_JUDGE_AUTHORING_ACTION.CLOSE,
    });
  };

  const handleAiJudgeGenerationDialogOpenChange = (open: boolean) => {
    if (open) return;
    dispatchAiJudgeAuthoring({
      type:
        aiJudgeGenerationMode === AI_JUDGE_GENERATION_MODE.IMPROVE
          ? AI_JUDGE_AUTHORING_ACTION.OPEN_EDITOR
          : AI_JUDGE_AUTHORING_ACTION.CLOSE,
    });
    resetAiJudgeConfigurationGeneration();
  };

  const handleAiJudgeEditorOpenChange = (open: boolean) => {
    dispatchAiJudgeAuthoring({
      type: open ? AI_JUDGE_AUTHORING_ACTION.OPEN_EDITOR : AI_JUDGE_AUTHORING_ACTION.CLOSE,
    });
  };

  useEffect(() => {
    setAvatarPreview(lessonToEdit?.avatarReferenceUrl ?? null);
    setSelectedAvatarFile(null);
    setRemoveAvatar(false);

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, [lessonToEdit]);

  const onCloseModal = () => {
    setIsModalOpen(false);
  };

  const onClickDelete = () => {
    setIsModalOpen(true);
  };

  const onOpenPreview = () => setPreviewOpen(true);
  const onClosePreview = () => setPreviewOpen(false);
  const onOpenAvatarDialog = () => {
    setIsAvatarDialogOpen(true);
  };

  const revokeObjectUrl = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  const handleAvatarSave = async ({ file, remove }: { file: File | null; remove: boolean }) => {
    if (!lessonToEdit?.id) return;

    await uploadAvatar({ lessonId: lessonToEdit.id, file });

    await queryClient.invalidateQueries({ queryKey: [COURSE_QUERY_KEY, { id }] });

    if (remove) {
      revokeObjectUrl();
      setAvatarPreview(null);
      setSelectedAvatarFile(null);
      setRemoveAvatar(false);
      return;
    }

    if (file) {
      revokeObjectUrl();
      const objectUrl = URL.createObjectURL(file);
      objectUrlRef.current = objectUrl;
      setAvatarPreview(objectUrl);
      setSelectedAvatarFile(null);
      setRemoveAvatar(false);
      return;
    }

    setSelectedAvatarFile(null);
    setRemoveAvatar(false);
  };

  const handleRemoveAvatar = () => {
    revokeObjectUrl();
    setAvatarPreview(null);
    setSelectedAvatarFile(null);
    setRemoveAvatar(true);
  };

  const handleAvatarDialogCancel = () => {
    setIsAvatarDialogOpen(false);
  };

  return (
    <>
      {lessonToEdit && previewOpen && (
        <AiMentorLessonPreview lesson={lessonToEdit} onClose={onClosePreview} />
      )}
      <TooltipProvider delayDuration={0}>
        <div
          data-testid={AI_MENTOR_LESSON_FORM_HANDLES.ROOT}
          className="relative flex flex-col gap-y-6 rounded-lg bg-white p-8"
        >
          {hasMissingTranslations && <MissingTranslationsAlert />}
          <div className="flex flex-col gap-y-1">
            {!lessonToEdit && (
              <Breadcrumb
                lessonLabel={t("common.lessonTypes.ai_mentor")}
                setContentTypeToDisplay={setContentTypeToDisplay}
                setSelectedLesson={setSelectedLesson}
              />
            )}
            <div className="h5 text-neutral-950">
              {lessonToEdit ? (
                <>
                  <span className="text-neutral-600">
                    {t("adminCourseView.curriculum.other.edit")}:{" "}
                  </span>
                  <span className="font-bold">{lessonToEdit.title}</span>
                </>
              ) : (
                t("common.button.create")
              )}
            </div>
          </div>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) =>
                onSubmit(data, removeAvatar ? null : (selectedAvatarFile ?? undefined)),
              )}
              className="flex grow flex-col"
            >
              <AiMentorIdentityFields
                control={form.control}
                avatarPreview={avatarPreview}
                canEditAvatar={Boolean(lessonToEdit)}
                onEditAvatar={onOpenAvatarDialog}
                onRemoveAvatar={handleRemoveAvatar}
              />

              <AiMentorScenarioFields control={form.control} />

              {canConfigureVoiceMentor && (
                <AiMentorVoiceConfigurationFields form={form} tooltipKey={voiceConfigTooltipKey} />
              )}

              <AiMentorInstructionsField control={form.control} />
              <AiJudgeConfigurationCard
                value={aiJudgeConfiguration}
                onSaveBaseConfiguration={handleAiJudgeBaseConfigurationSave}
                onSaveTranslation={handleAiJudgeTranslationSave}
                language={language}
                baseLanguage={baseLanguage}
                isPersisted={Boolean(lessonToEdit)}
                isLoading={Boolean(lessonToEdit) && isAiJudgeConfigurationLoading}
                isSaving={
                  isReplacingAiJudgeConfiguration || isUpdatingAiJudgeConfigurationTranslation
                }
                onConfigureWithAi={handleConfigureAiJudgeWithAi}
                editorOpen={isAiJudgeEditorOpen}
                onEditorOpenChange={handleAiJudgeEditorOpenChange}
                onValidateConfiguration={handleValidateAiJudgeConfiguration}
                onImproveWithAi={handleImproveAiJudgeConfigurationAfterValidation}
                isValidating={isValidatingAiJudgeConfiguration}
                error={
                  form.formState.errors.aiJudgeConfiguration
                    ? t(
                        "adminCourseView.curriculum.lesson.aiJudge.validation.configurationRequired",
                      )
                    : undefined
                }
              />
              <AiJudgeGenerationDialog
                open={isAiJudgeGenerationDialogOpen}
                onOpenChange={handleAiJudgeGenerationDialogOpenChange}
                mode={aiJudgeGenerationMode}
                state={visibleAiJudgeGenerationState}
                onGenerate={handleGenerateAiJudgeConfiguration}
                onCancel={handleCancelAiJudgeConfigurationGeneration}
                onRevise={reviseAiJudgeConfigurationGeneration}
                isRevising={isRevisingAiJudgeConfigurationGeneration}
                onStopAndInspect={handleStopAndInspectAiJudgeConfiguration}
                onReviewAssessment={handleEditGeneratedAiJudgeConfiguration}
              />
              <AiMentorSuggestionExamples onSuggestionClick={handleSuggestionClick} />
              {lessonToEdit && (
                <div className="mb-6">
                  <MultiFileUploadForm lessonId={lessonToEdit.id} />
                </div>
              )}

              <div className="flex justify-between">
                <div className="flex gap-x-4">
                  <Button data-testid={AI_MENTOR_LESSON_FORM_HANDLES.SAVE_BUTTON} type="submit">
                    {t("common.button.save")}
                  </Button>
                  {lessonToEdit && (
                    <Button
                      data-testid={AI_MENTOR_LESSON_FORM_HANDLES.DELETE_BUTTON}
                      type="button"
                      onClick={onClickDelete}
                      className="bg-color-white border border-neutral-300 text-error-700"
                    >
                      {t("common.button.delete")}
                    </Button>
                  )}
                </div>
                {lessonToEdit && (
                  <Button
                    data-testid={AI_MENTOR_LESSON_FORM_HANDLES.PREVIEW_BUTTON}
                    type="button"
                    onClick={onOpenPreview}
                    variant="primary"
                  >
                    {t("adminCourseView.common.testAiMentor")}
                  </Button>
                )}
              </div>
            </form>
          </Form>

          <DeleteConfirmationModal
            open={isModalOpen}
            onClose={onCloseModal}
            onDelete={onDelete}
            contentType={DeleteContentType.AI_MENTOR}
          />

          <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {t("adminCourseView.curriculum.lesson.other.overwriteContent")}
                </DialogTitle>
                <DialogDescription>
                  {t("adminCourseView.curriculum.lesson.other.overwriteContentDescription")}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={onCancelOverwrite}>
                  {t("common.button.cancel")}
                </Button>
                <Button onClick={onConfirmOverwrite} className="bg-primary-700">
                  {t("clientStatisticsView.button.continue")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <UpdateAiAvatarModal
            open={isAvatarDialogOpen}
            onOpenChange={(open) => {
              if (open) {
                onOpenAvatarDialog();
              } else {
                handleAvatarDialogCancel();
              }
            }}
            onCancel={handleAvatarDialogCancel}
            onSave={(data) => {
              void handleAvatarSave(data);
              setIsAvatarDialogOpen(false);
            }}
            currentPreview={avatarPreview}
            accept={ALLOWED_EXTENSIONS}
          />
        </div>
      </TooltipProvider>
    </>
  );
};

export default AiMentorLessonForm;
