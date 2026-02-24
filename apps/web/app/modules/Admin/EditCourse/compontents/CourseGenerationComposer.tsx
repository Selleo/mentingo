import {
  LUMA_FILE_INGESTION_ALLOWED_EXTENSIONS,
  LUMA_FILE_INGESTION_ALLOWED_MIME_TYPES,
} from "@repo/shared";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useDeleteCourseGenerationFile } from "~/api/mutations/admin/useDeleteCourseGenerationFile";
import { useIngestCourseGenerationFiles } from "~/api/mutations/admin/useIngestCourseGenerationFiles";
import { useCourseGenerationFiles } from "~/api/queries/admin/useCourseGenerationFiles";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { CourseGenerationFileList } from "~/modules/Admin/EditCourse/compontents/CourseGenerationFileList";
import { CourseGenerationFileUpload } from "~/modules/Admin/EditCourse/compontents/CourseGenerationFileUpload";

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
  onInputChange: (value: string) => void;
  onSubmit: () => void;
};

export function CourseGenerationComposer({
  integrationId,
  input,
  onInputChange,
  onSubmit,
}: CourseGenerationComposerProps) {
  const { t } = useTranslation();
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const { data: ingestedFiles = [] } = useCourseGenerationFiles(integrationId, !!integrationId);
  const { mutateAsync: ingestFiles, isPending: isIngestPending } = useIngestCourseGenerationFiles();
  const { mutateAsync: deleteFile, isPending: isDeletePending } = useDeleteCourseGenerationFile();
  const placeholders = PLACEHOLDER_KEYS.map((key) => t(key));

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

  const removeFile = async (documentId: string) => {
    if (!integrationId) return;
    await deleteFile({ integrationId, documentId });
  };

  const handleSubmit = () => {
    if (!input.trim().length) return;
    onSubmit();
  };

  const currentPlaceholder = placeholders[placeholderIndex];

  return (
    <div className="mx-auto w-full max-w-[620px]">
      <div className="rounded-2xl border border-neutral-200 bg-white px-3 py-3 shadow-md">
        <CourseGenerationFileList
          files={ingestedFiles}
          onRemoveFile={removeFile}
          disableRemove={isDeletePending}
        />

        <div className="flex items-center gap-2">
          <CourseGenerationFileUpload
            disabled={isIngestPending || isDeletePending || !integrationId}
            onFilesSelected={handleFilesSelected}
          />

          <div className="relative h-8 min-w-0 flex-1">
            <input
              value={input}
              onChange={(event) => onInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSubmit();
                }
              }}
              className="h-8 w-full border-none bg-transparent text-sm text-neutral-950 focus:outline-none"
            />

            {!input.trim() && (
              <div className="pointer-events-none absolute inset-0 flex items-center overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={currentPlaceholder}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="block w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm text-neutral-500"
                  >
                    {currentPlaceholder.split("").map((char, index) => (
                      <motion.span
                        key={`${char}-${index}`}
                        initial={{ opacity: 0, x: -2 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.16, delay: index * 0.018 }}
                      >
                        {char === " " ? "\u00A0" : char}
                      </motion.span>
                    ))}
                  </motion.span>
                </AnimatePresence>
              </div>
            )}
          </div>

          <Button
            type="button"
            variant="default"
            onClick={handleSubmit}
            className="flex size-8 p-0 items-center justify-center rounded-lg"
            aria-label="Send"
          >
            <Icon name="Send" className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
