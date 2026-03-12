import {
  LUMA_FILE_INGESTION_ALLOWED_EXTENSIONS,
  LUMA_FILE_INGESTION_ALLOWED_MIME_TYPES,
} from "@repo/shared";
import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useTranslation } from "react-i18next";

import { useIngestCourseGenerationFiles } from "~/api/mutations/admin/useIngestCourseGenerationFiles";
import { CourseGenerationComposerCenterContent } from "~/modules/Admin/EditCourse/components/course-generation/CourseGenerationComposerCenterContent";
import { CourseGenerationComposerLeftControl } from "~/modules/Admin/EditCourse/components/course-generation/CourseGenerationComposerLeftControl";
import { CourseGenerationComposerRightControls } from "~/modules/Admin/EditCourse/components/course-generation/CourseGenerationComposerRightControls";
import { useTranscription } from "~/modules/Voice/hooks/useTranscription";

const PLACEHOLDER_KEYS = [
  "adminCourseView.curriculum.lesson.courseGenerationComposer.placeholders.topic",
  "adminCourseView.curriculum.lesson.courseGenerationComposer.placeholders.targetAudience",
  "adminCourseView.curriculum.lesson.courseGenerationComposer.placeholders.currentLevel",
  "adminCourseView.curriculum.lesson.courseGenerationComposer.placeholders.desiredOutcomes",
  "adminCourseView.curriculum.lesson.courseGenerationComposer.placeholders.constraintsPrerequisites",
  "adminCourseView.curriculum.lesson.courseGenerationComposer.placeholders.preferredFormatAssessment",
  "adminCourseView.curriculum.lesson.courseGenerationComposer.placeholders.timeBudget",
  "adminCourseView.curriculum.lesson.courseGenerationComposer.placeholders.successCriteriaDomainContext",
];

type CourseGenerationComposerProps = {
  integrationId: string;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
};

export function CourseGenerationComposer({
  integrationId,
  input,
  onInputChange,
  onSubmit,
  setInput,
}: CourseGenerationComposerProps) {
  const { t } = useTranslation();
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { mutateAsync: ingestFiles, isPending: isIngestPending } = useIngestCourseGenerationFiles();
  const placeholders = useMemo(() => PLACEHOLDER_KEYS.map((key) => t(key)), [t]);

  const { startRecording, stopRecording, cancelTranscription } = useTranscription({
    setInput,
    onLevelChange: setVoiceLevel,
  });

  useEffect(() => {
    if (input.trim().length > 0) return;

    const interval = window.setInterval(() => {
      setPlaceholderIndex((current) => (current + 1) % placeholders.length);
    }, 3200);

    return () => window.clearInterval(interval);
  }, [input, placeholders.length]);

  const isAllowedCourseGenerationFile = (file: File) => {
    if (
      LUMA_FILE_INGESTION_ALLOWED_MIME_TYPES.includes(
        file.type as (typeof LUMA_FILE_INGESTION_ALLOWED_MIME_TYPES)[number],
      )
    ) {
      return true;
    }

    const fileExtension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
    return LUMA_FILE_INGESTION_ALLOWED_EXTENSIONS.includes(
      fileExtension as (typeof LUMA_FILE_INGESTION_ALLOWED_EXTENSIONS)[number],
    );
  };

  const handleFilesSelected = async (files: File[]) => {
    if (!files.length) return;
    if (!integrationId) return;

    const allowedFiles = files.filter(isAllowedCourseGenerationFile);
    if (!allowedFiles.length) return;

    await ingestFiles({ integrationId, files: allowedFiles });
  };
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    void handleFilesSelected(files);
    event.target.value = "";
  };

  const handleSubmit = () => {
    if (!input.trim().length) return;
    onSubmit();
  };

  const currentPlaceholder = placeholders[placeholderIndex];
  const isUploadDisabled = isIngestPending || !integrationId;
  const startVoiceMode = async () => {
    const hasStarted = await startRecording();
    if (!hasStarted) return;
    setIsVoiceMode(true);
  };

  const stopVoiceMode = async () => {
    await stopRecording();
    setIsVoiceMode(false);
    setVoiceLevel(0);
  };

  const cancelVoiceMode = async () => {
    await cancelTranscription();
    setIsVoiceMode(false);
    setVoiceLevel(0);
  };

  return (
    <div className="mx-auto w-full max-w-[620px]">
      <div className="rounded-2xl border border-neutral-200 bg-white px-3 py-3 shadow-md">
        <div className="grid grid-cols-[2rem_1fr_2rem_2rem] items-end gap-2">
          <CourseGenerationComposerLeftControl
            isVoiceMode={isVoiceMode}
            isUploadDisabled={isUploadDisabled}
            onAttachFile={() => fileInputRef.current?.click()}
            onCloseVoiceMode={() => void cancelVoiceMode()}
          />

          <CourseGenerationComposerCenterContent
            isVoiceMode={isVoiceMode}
            input={input}
            currentPlaceholder={currentPlaceholder}
            voiceLevel={voiceLevel}
            onInputChange={onInputChange}
            onSubmit={handleSubmit}
          />

          <CourseGenerationComposerRightControls
            isVoiceMode={isVoiceMode}
            onStartVoiceMode={() => void startVoiceMode()}
            onStopVoiceMode={() => void stopVoiceMode()}
            onSubmit={handleSubmit}
          />
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          disabled={isUploadDisabled}
          accept={LUMA_FILE_INGESTION_ALLOWED_EXTENSIONS.join(",")}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
}
