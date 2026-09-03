import { useParams } from "@remix-run/react";
import {
  AI_JUDGE_GENERATION_MAX_ATTEMPTS,
  AI_MENTOR_CONFIGURATION_GENERATION_MAX_ATTEMPTS,
  AI_MENTOR_CONFIGURATION_GENERATION_STATUS,
  AI_MENTOR_TYPE,
  ALLOWED_EXTENSIONS,
} from "@repo/shared";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useReplaceAiJudgeConfiguration } from "~/api/mutations/admin/useReplaceAiJudgeConfiguration";
import { useReplaceAiMentorConfiguration } from "~/api/mutations/admin/useReplaceAiMentorConfiguration";
import { useUpdateAiJudgeConfigurationTranslation } from "~/api/mutations/admin/useUpdateAiJudgeConfigurationTranslation";
import { useUpdateAiMentorConfigurationTranslation } from "~/api/mutations/admin/useUpdateAiMentorConfigurationTranslation";
import { useUploadAiMentorAvatar } from "~/api/mutations/admin/useUploadAiMentorAvatar";
import { useValidateAiJudgeConfiguration } from "~/api/mutations/admin/useValidateAiJudgeConfiguration";
import { useValidateAiMentorConfiguration } from "~/api/mutations/admin/useValidateAiMentorConfiguration";
import { useAiJudgeConfiguration } from "~/api/queries/admin/useAiJudgeConfiguration";
import { useAiMentorConfiguration } from "~/api/queries/admin/useAiMentorConfiguration";
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
import { getBaseLanguageTextPlaceholder } from "~/modules/Admin/EditCourse/utils/baseLanguageText";

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
import {
  mapAiMentorConfigurationDraftToBaseInput,
  mapAiMentorConfigurationDraftToTranslationInput,
  mapAiMentorConfigurationResponseToDraft,
} from "./AiMentorConfiguration/aiMentorConfiguration.mappers";
import { AiMentorConfigurationCard } from "./AiMentorConfiguration/AiMentorConfigurationCard";
import {
  AI_MENTOR_AUTHORING_ACTION,
  AI_MENTOR_AUTHORING_VIEW,
  aiMentorAuthoringReducer,
  INITIAL_AI_MENTOR_AUTHORING_STATE,
} from "./AiMentorGeneration/aiMentorAuthoring.reducer";
import { getApplicableAiMentorGeneratedConfiguration } from "./AiMentorGeneration/aiMentorGeneration.mappers";
import {
  buildAiMentorGenerationInput,
  buildAiMentorValidationInput,
} from "./AiMentorGeneration/aiMentorGeneration.requests";
import { AI_MENTOR_GENERATION_MODE } from "./AiMentorGeneration/aiMentorGeneration.types";
import { AiMentorGenerationDialog } from "./AiMentorGeneration/AiMentorGenerationDialog";
import { useAiMentorConfigurationGeneration } from "./AiMentorGeneration/useAiMentorConfigurationGeneration";
import { AiMentorIdentityFields } from "./components/AiMentorIdentityFields";
import { AiMentorScenarioFields } from "./components/AiMentorScenarioFields";
import { AiMentorScenarioTemplateSelect } from "./components/AiMentorScenarioTemplateSelect";
import { AiMentorVoiceConfigurationFields } from "./components/AiMentorVoiceConfigurationFields";
import { useAiMentorLessonForm } from "./hooks/useAiMentorLessonForm";
import UpdateAiAvatarModal from "./UpdateAiAvatarModal";
import {
  buildAiMentorScenarioTemplateDraft,
  type AiMentorScenarioTemplate,
} from "./utils/AiMentorScenarioTemplate.helpers";
import { stripHtmlTags } from "./validators/useAiMentorLessonFormSchema";

import type {
  AiJudgeConfigurationDraft,
  AiJudgeGenerationMode,
  AiJudgeGenerationRequest,
  AiJudgeValidationResult,
} from "./AiJudge/aiJudgeConfiguration.types";
import type { AiMentorConfigurationDraft } from "./AiMentorConfiguration/aiMentorConfiguration.types";
import type {
  AiMentorGenerationMode,
  AiMentorGenerationRequest,
  AiMentorGenerationViewState,
  AiMentorValidationResult,
} from "./AiMentorGeneration/aiMentorGeneration.types";
import type { Chapter, Lesson } from "../../../EditCourse.types";
import type { AiMentorType, SupportedLanguages } from "@repo/shared";

type AiMentorLessonProps = {
  setContentTypeToDisplay: (contentTypeToDisplay: string) => void;
  chapterToEdit: Chapter | null;
  lessonToEdit: Lesson | null;
  baseLanguageLesson: Lesson | null;
  setSelectedLesson: (selectedLesson: Lesson | null) => void;
  language: SupportedLanguages;
  baseLanguage: SupportedLanguages;
};

const AiMentorLessonForm = ({
  setContentTypeToDisplay,
  chapterToEdit,
  lessonToEdit,
  baseLanguageLesson,
  setSelectedLesson,
  language,
  baseLanguage,
}: AiMentorLessonProps) => {
  const { mutateAsync: replaceAiJudgeConfiguration, isPending: isReplacingAiJudgeConfiguration } =
    useReplaceAiJudgeConfiguration();
  const { mutateAsync: replaceAiMentorConfiguration, isPending: isReplacingAiMentorConfiguration } =
    useReplaceAiMentorConfiguration();
  const saveStagedAiMentorConfiguration = async (configuration: AiMentorConfigurationDraft) => {
    if (!lessonToEdit) return;

    await replaceAiMentorConfiguration({
      lessonId: lessonToEdit.id,
      data: mapAiMentorConfigurationDraftToBaseInput(configuration),
    });
  };
  const saveStagedAiJudgeConfiguration = async (configuration: AiJudgeConfigurationDraft) => {
    if (!lessonToEdit) return;

    await replaceAiJudgeConfiguration({
      lessonId: lessonToEdit.id,
      language: baseLanguage,
      data: mapAiJudgeConfigurationDraftToBaseInput(configuration),
    });
  };

  const { form, onSubmit, onDelete } = useAiMentorLessonForm({
    chapterToEdit,
    lessonToEdit,
    setContentTypeToDisplay,
    language,
    baseLanguage,
    onSaveStagedAiMentorConfiguration: saveStagedAiMentorConfiguration,
    onSaveStagedAiJudgeConfiguration: saveStagedAiJudgeConfiguration,
  });

  const { t } = useTranslation();

  const { id = "" } = useParams();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAvatarDialogOpen, setIsAvatarDialogOpen] = useState(false);
  const [pendingScenarioTemplate, setPendingScenarioTemplate] =
    useState<AiMentorScenarioTemplate | null>(null);
  const [aiJudgeAuthoringState, dispatchAiJudgeAuthoring] = useReducer(
    aiJudgeAuthoringReducer,
    INITIAL_AI_JUDGE_AUTHORING_STATE,
  );
  const aiJudgeGenerationMode = getAiJudgeGenerationMode(aiJudgeAuthoringState);
  const latestAiJudgeValidation = getLatestAiJudgeValidation(aiJudgeAuthoringState);
  const isAiJudgeEditorOpen = aiJudgeAuthoringState.view === AI_JUDGE_AUTHORING_VIEW.EDITOR;
  const isAiJudgeGenerationDialogOpen =
    aiJudgeAuthoringState.view === AI_JUDGE_AUTHORING_VIEW.GENERATION;
  const [aiMentorAuthoringState, dispatchAiMentorAuthoring] = useReducer(
    aiMentorAuthoringReducer,
    INITIAL_AI_MENTOR_AUTHORING_STATE,
  );
  const [aiMentorGenerationType, setAiMentorGenerationType] = useState<AiMentorType>(
    AI_MENTOR_TYPE.ROLEPLAY,
  );
  const [latestAiMentorValidation, setLatestAiMentorValidation] =
    useState<AiMentorValidationResult>();
  const aiMentorGenerationMode = aiMentorAuthoringState.mode ?? AI_MENTOR_GENERATION_MODE.CREATE;
  const isAiMentorEditorOpen = aiMentorAuthoringState.view === AI_MENTOR_AUTHORING_VIEW.EDITOR;
  const isAiMentorGenerationDialogOpen =
    aiMentorAuthoringState.view === AI_MENTOR_AUTHORING_VIEW.GENERATION;
  const [previewOpen, setPreviewOpen] = useState(false);
  const {
    generationType: capturedAiMentorGenerationType,
    state: aiMentorGenerationState,
    startGeneration: startAiMentorConfigurationGeneration,
    cancelGeneration: cancelAiMentorConfigurationGeneration,
    reviseGeneration: reviseAiMentorConfigurationGeneration,
    resetGeneration: resetAiMentorConfigurationGeneration,
    isStarting: isStartingAiMentorConfigurationGeneration,
  } = useAiMentorConfigurationGeneration();
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
  const {
    mutateAsync: validateAiMentorConfiguration,
    isPending: isValidatingAiMentorConfiguration,
  } = useValidateAiMentorConfiguration();
  const validateCurrentAiMentorConfiguration = useCallback(
    (configuration: AiMentorConfigurationDraft, signal?: AbortSignal) =>
      validateAiMentorConfiguration({
        data: buildAiMentorValidationInput(
          {
            courseId: id,
            lessonId: lessonToEdit?.id,
            lessonContext: {
              title: form.getValues("title") || undefined,
              taskDescription: form.getValues("description") || undefined,
            },
          },
          configuration,
        ),
        signal,
      }),
    [form, id, lessonToEdit?.id, validateAiMentorConfiguration],
  );
  const { mutateAsync: uploadAvatar } = useUploadAiMentorAvatar();
  const {
    mutateAsync: updateAiJudgeConfigurationTranslation,
    isPending: isUpdatingAiJudgeConfigurationTranslation,
  } = useUpdateAiJudgeConfigurationTranslation();
  const {
    mutateAsync: updateAiMentorConfigurationTranslation,
    isPending: isUpdatingAiMentorConfigurationTranslation,
  } = useUpdateAiMentorConfigurationTranslation();
  const lessonId = lessonToEdit?.id ?? "";
  const { data: savedAiJudgeConfiguration, isLoading: isAiJudgeConfigurationLoading } =
    useAiJudgeConfiguration(lessonId, language);
  const { data: savedAiMentorConfiguration, isLoading: isAiMentorConfigurationLoading } =
    useAiMentorConfiguration(lessonId, language);

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
  const hasStagedAiMentorConfigurationRef = useRef(false);
  const hasStagedAiJudgeConfigurationRef = useRef(false);
  const stagedAiMentorConfiguration = form.watch("aiMentorConfiguration");
  const stagedAiJudgeConfiguration = form.watch("aiJudgeConfiguration");
  const persistedAiMentorConfiguration = useMemo(
    () =>
      savedAiMentorConfiguration
        ? mapAiMentorConfigurationResponseToDraft(savedAiMentorConfiguration)
        : undefined,
    [savedAiMentorConfiguration],
  );
  const persistedAiJudgeConfiguration = useMemo(
    () =>
      savedAiJudgeConfiguration
        ? mapAiJudgeConfigurationResponseToDraft(savedAiJudgeConfiguration)
        : undefined,
    [savedAiJudgeConfiguration],
  );
  const aiMentorConfiguration = stagedAiMentorConfiguration ?? persistedAiMentorConfiguration;
  const aiJudgeConfiguration = stagedAiJudgeConfiguration ?? persistedAiJudgeConfiguration;
  const isAiMentorConfigurationDirty = Boolean(form.formState.dirtyFields.aiMentorConfiguration);
  const isAiJudgeConfigurationDirty = Boolean(form.formState.dirtyFields.aiJudgeConfiguration);

  const applyScenarioTemplate = (template: AiMentorScenarioTemplate) => {
    const draft = buildAiMentorScenarioTemplateDraft(template, t);
    hasStagedAiMentorConfigurationRef.current = true;
    hasStagedAiJudgeConfigurationRef.current = true;
    form.setValue("description", draft.taskDescription, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("aiMentorConfiguration", draft.aiMentorConfiguration, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("aiJudgeConfiguration", draft.aiJudgeConfiguration, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setPendingScenarioTemplate(null);
  };

  const handleScenarioTemplateSelect = (template: AiMentorScenarioTemplate) => {
    const hasExistingContent =
      Boolean(stripHtmlTags(form.getValues("description") ?? "")) ||
      Boolean(form.getValues("aiMentorConfiguration")) ||
      Boolean(form.getValues("aiJudgeConfiguration"));

    if (hasExistingContent) {
      setPendingScenarioTemplate(template);
      return;
    }

    applyScenarioTemplate(template);
  };

  useEffect(() => {
    hasStagedAiMentorConfigurationRef.current = false;
    hasStagedAiJudgeConfigurationRef.current = false;
  }, [language, lessonToEdit?.id]);

  useEffect(() => {
    if (
      !lessonToEdit ||
      !persistedAiMentorConfiguration ||
      isAiMentorConfigurationDirty ||
      hasStagedAiMentorConfigurationRef.current
    )
      return;

    form.setValue("aiMentorConfiguration", persistedAiMentorConfiguration, {
      shouldDirty: false,
      shouldValidate: false,
    });
  }, [form, isAiMentorConfigurationDirty, lessonToEdit, persistedAiMentorConfiguration]);

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
        savedAiMentorConfiguration?.hasMissingTranslations ||
        savedAiJudgeConfiguration?.hasMissingTranslations),
  );

  const handleAiMentorBaseConfigurationSave = async (configuration: AiMentorConfigurationDraft) => {
    const normalizedConfiguration = mapAiMentorConfigurationDraftToBaseInput(configuration);

    if (lessonToEdit) {
      await replaceAiMentorConfiguration({
        lessonId: lessonToEdit.id,
        data: normalizedConfiguration,
      });
      hasStagedAiMentorConfigurationRef.current = false;
      form.resetField("aiMentorConfiguration", {
        defaultValue: normalizedConfiguration,
      });
      return;
    }

    hasStagedAiMentorConfigurationRef.current = true;
    form.setValue("aiMentorConfiguration", normalizedConfiguration, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const handleAiMentorTranslationSave = async (configuration: AiMentorConfigurationDraft) => {
    if (!lessonToEdit) return;

    await updateAiMentorConfigurationTranslation({
      courseId: id,
      lessonId: lessonToEdit.id,
      language,
      data: mapAiMentorConfigurationDraftToTranslationInput(configuration),
    });
  };

  const getAiMentorLessonContext = () => ({
    title: form.getValues("title") || undefined,
    taskDescription: form.getValues("description") || undefined,
  });

  const openAiMentorGeneration = (mode: AiMentorGenerationMode) => {
    resetAiMentorConfigurationGeneration();
    const currentConfiguration = form.getValues("aiMentorConfiguration");
    setAiMentorGenerationType(currentConfiguration?.type ?? AI_MENTOR_TYPE.ROLEPLAY);
    if (mode === AI_MENTOR_GENERATION_MODE.CREATE) setLatestAiMentorValidation(undefined);
    dispatchAiMentorAuthoring({
      type: AI_MENTOR_AUTHORING_ACTION.OPEN_GENERATION,
      mode,
    });
  };

  const handleGenerateAiMentorConfiguration = async (request: AiMentorGenerationRequest) => {
    await startAiMentorConfigurationGeneration(
      buildAiMentorGenerationInput(
        {
          courseId: id,
          lessonId: lessonToEdit?.id,
          lessonContext: getAiMentorLessonContext(),
        },
        request,
        latestAiMentorValidation,
      ),
    );
  };

  const stageGeneratedAiMentorConfiguration = (configuration: AiMentorConfigurationDraft) => {
    hasStagedAiMentorConfigurationRef.current = true;
    form.setValue("aiMentorConfiguration", configuration, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const handleReviewAiMentorConfiguration = (state: AiMentorGenerationViewState) => {
    const currentType = form.getValues("aiMentorConfiguration")?.type ?? aiMentorGenerationType;
    const configuration = getApplicableAiMentorGeneratedConfiguration(
      state.draft,
      capturedAiMentorGenerationType,
      currentType,
    );
    if (!configuration) return;

    stageGeneratedAiMentorConfiguration(configuration);
    resetAiMentorConfigurationGeneration();
    dispatchAiMentorAuthoring({ type: AI_MENTOR_AUTHORING_ACTION.OPEN_EDITOR });
  };

  const handleCancelAiMentorConfigurationGeneration = async () => {
    await cancelAiMentorConfigurationGeneration();
    resetAiMentorConfigurationGeneration();
    if (aiMentorGenerationMode === AI_MENTOR_GENERATION_MODE.IMPROVE) {
      dispatchAiMentorAuthoring({ type: AI_MENTOR_AUTHORING_ACTION.OPEN_EDITOR });
      return;
    }
    dispatchAiMentorAuthoring({ type: AI_MENTOR_AUTHORING_ACTION.CLOSE });
  };

  const handleAiMentorGenerationDialogOpenChange = (open: boolean) => {
    if (open) return;
    resetAiMentorConfigurationGeneration();
    if (aiMentorGenerationMode === AI_MENTOR_GENERATION_MODE.IMPROVE) {
      dispatchAiMentorAuthoring({ type: AI_MENTOR_AUTHORING_ACTION.OPEN_EDITOR });
      return;
    }
    dispatchAiMentorAuthoring({ type: AI_MENTOR_AUTHORING_ACTION.CLOSE });
  };

  const handleAiMentorEditorOpenChange = (open: boolean) => {
    dispatchAiMentorAuthoring({
      type: open ? AI_MENTOR_AUTHORING_ACTION.OPEN_EDITOR : AI_MENTOR_AUTHORING_ACTION.CLOSE,
    });
  };

  const handleImproveAiMentorConfiguration = (
    configuration: AiMentorConfigurationDraft,
    validation?: AiMentorValidationResult,
  ) => {
    const lessonContext = getAiMentorLessonContext();
    stageGeneratedAiMentorConfiguration(configuration);
    resetAiMentorConfigurationGeneration();
    setAiMentorGenerationType(configuration.type);
    setLatestAiMentorValidation(validation);
    dispatchAiMentorAuthoring({
      type: AI_MENTOR_AUTHORING_ACTION.OPEN_GENERATION,
      mode: AI_MENTOR_GENERATION_MODE.IMPROVE,
    });

    if (!validation) return;

    const instruction = validation.issues.map(({ correction }) => correction).join("\n\n");
    void startAiMentorConfigurationGeneration(
      buildAiMentorGenerationInput(
        {
          courseId: id,
          lessonId: lessonToEdit?.id,
          lessonContext,
        },
        {
          mode: AI_MENTOR_GENERATION_MODE.IMPROVE,
          instruction: instruction || validation.summary,
          currentConfiguration: mapAiMentorConfigurationDraftToBaseInput(configuration),
        },
        validation,
      ),
    ).catch(() => {
      resetAiMentorConfigurationGeneration();
      dispatchAiMentorAuthoring({ type: AI_MENTOR_AUTHORING_ACTION.OPEN_EDITOR });
    });
  };

  const visibleAiMentorGenerationState =
    aiMentorGenerationState ??
    (isStartingAiMentorConfigurationGeneration
      ? {
          generationId: "",
          status: AI_MENTOR_CONFIGURATION_GENERATION_STATUS.DRAFTING,
          type: aiMentorGenerationType,
          attempt: 1,
          maxAttempts: AI_MENTOR_CONFIGURATION_GENERATION_MAX_ATTEMPTS,
          changes: [],
        }
      : undefined);

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

  const getAiJudgeLessonContext = () => {
    const configuration = form.getValues("aiMentorConfiguration");

    return {
      title: form.getValues("title") || undefined,
      taskDescription: form.getValues("description") || undefined,
      ...(configuration && {
        aiMentorConfiguration: mapAiMentorConfigurationDraftToBaseInput(configuration),
      }),
    };
  };

  const handleGenerateAiJudgeConfiguration = async ({
    mode,
    instruction,
  }: AiJudgeGenerationRequest) => {
    const lessonContext = getAiJudgeLessonContext();

    const commonInput = {
      courseId: id,
      lessonId: lessonToEdit?.id,
      lessonContext,
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

  const handleValidateAiJudgeConfiguration = async (
    configuration: AiJudgeConfigurationDraft,
    signal?: AbortSignal,
  ) => {
    const lessonContext = getAiJudgeLessonContext();

    return validateAiJudgeConfiguration({
      data: {
        courseId: id,
        lessonId: lessonToEdit?.id,
        lessonContext,
        configuration: mapAiJudgeConfigurationDraftToBaseInput(configuration),
      },
      signal,
    });
  };

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
    const lessonContext = getAiJudgeLessonContext();
    if (!lessonContext) return;

    stageGeneratedAiJudgeConfiguration(configuration);
    openAiJudgeGeneration(AI_JUDGE_GENERATION_MODE.IMPROVE, validation);

    if (!validation) return;

    const instruction = validation.issues.map(({ correction }) => correction).join("\n\n");
    void startAiJudgeConfigurationGeneration({
      courseId: id,
      lessonId: lessonToEdit?.id,
      lessonContext,
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
                baseLanguageTitle={baseLanguageLesson?.title}
                baseLanguageName={baseLanguageLesson?.aiMentor?.name}
              />

              <AiMentorScenarioFields
                control={form.control}
                baseLanguageDescription={getBaseLanguageTextPlaceholder(
                  baseLanguageLesson?.description,
                )}
              />

              {language === baseLanguage && (
                <AiMentorScenarioTemplateSelect onSelect={handleScenarioTemplateSelect} />
              )}

              {canConfigureVoiceMentor && (
                <AiMentorVoiceConfigurationFields form={form} tooltipKey={voiceConfigTooltipKey} />
              )}

              <AiMentorConfigurationCard
                value={aiMentorConfiguration}
                onSaveBaseConfiguration={handleAiMentorBaseConfigurationSave}
                onSaveTranslation={handleAiMentorTranslationSave}
                language={language}
                baseLanguage={baseLanguage}
                isPersisted={Boolean(lessonToEdit)}
                isLoading={Boolean(lessonToEdit) && isAiMentorConfigurationLoading}
                isSaving={
                  isReplacingAiMentorConfiguration || isUpdatingAiMentorConfigurationTranslation
                }
                needsConfiguration={savedAiMentorConfiguration?.needsConfiguration}
                onCreateWithAi={() => openAiMentorGeneration(AI_MENTOR_GENERATION_MODE.CREATE)}
                onImproveWithAi={handleImproveAiMentorConfiguration}
                onValidateConfiguration={validateCurrentAiMentorConfiguration}
                isValidating={isValidatingAiMentorConfiguration}
                editorOpen={isAiMentorEditorOpen}
                onEditorOpenChange={handleAiMentorEditorOpenChange}
                error={
                  form.formState.errors.aiMentorConfiguration
                    ? t(
                        "adminCourseView.curriculum.lesson.aiMentorConfiguration.validation.configurationRequired",
                      )
                    : undefined
                }
              />
              <AiMentorGenerationDialog
                open={isAiMentorGenerationDialogOpen}
                onOpenChange={handleAiMentorGenerationDialogOpenChange}
                mode={aiMentorGenerationMode}
                selectedType={aiMentorGenerationType}
                onSelectedTypeChange={setAiMentorGenerationType}
                currentConfiguration={aiMentorConfiguration}
                state={visibleAiMentorGenerationState}
                onGenerate={handleGenerateAiMentorConfiguration}
                onCancel={handleCancelAiMentorConfigurationGeneration}
                onRevise={reviseAiMentorConfigurationGeneration}
                onReview={handleReviewAiMentorConfiguration}
              />
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
                isAiMentorConfigured={Boolean(aiMentorConfiguration)}
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

          <Dialog
            open={Boolean(pendingScenarioTemplate)}
            onOpenChange={(open) => {
              if (!open) setPendingScenarioTemplate(null);
            }}
          >
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
                <Button variant="outline" onClick={() => setPendingScenarioTemplate(null)}>
                  {t("common.button.cancel")}
                </Button>
                <Button
                  data-testid="curriculum-ai-mentor-scenario-template-confirm"
                  onClick={() => {
                    if (pendingScenarioTemplate) applyScenarioTemplate(pendingScenarioTemplate);
                  }}
                  className="bg-primary-700"
                >
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
