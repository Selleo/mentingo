import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useDeleteDocumentLink } from "~/api/mutations/admin/useDeleteDocumentLink";
import { useUploadAiMentorFiles } from "~/api/mutations/admin/useUploadAiMentorFiles";
import {
  aiMentorLessonFilesQueryOptions,
  useAiMentorLessonFiles,
} from "~/api/queries/admin/useAiMentorLessonFiles";
import { queryClient } from "~/api/queryClient";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  MAX_MB_PER_FILE,
  MAX_NUM_OF_FILES,
} from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/AiMentorLessonForm/AiMentorLesson.constants";
import { FileLoader } from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/AiMentorLessonForm/components/FileLoader";
import { UploadFileCard } from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/AiMentorLessonForm/components/UploadFileCard";

import { FILE_TYPES_MAP } from "../utils/AiMentor.constants";
import {
  type AiMentorLessonContextValues,
  aiMentorLessonFileSchema,
} from "../validators/useAiMentorLessonFormSchema";

export interface FileWithOptionalId extends File {
  id?: string | undefined;
}

export function MultiFileUploadForm({ lessonId }: { lessonId: string }) {
  const { t } = useTranslation();

  const { mutateAsync: uploadFiles, isPending: isUploadPending } = useUploadAiMentorFiles();
  const { mutateAsync: deleteDocumentLink, isPending: isDeletePending } = useDeleteDocumentLink();
  const { data: lessonFiles, isLoading: areFilesLoading } = useAiMentorLessonFiles(
    lessonId,
    isUploadPending,
    isDeletePending,
  );

  const mapFiles = useCallback(() => {
    return (
      lessonFiles?.data?.map(
        (file) =>
          ({
            id: file.id,
            name: file.name,
            type: file.type,
            size: file.size,
          }) as FileWithOptionalId,
      ) ?? []
    );
  }, [lessonFiles]);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<AiMentorLessonContextValues>({
    defaultValues: {
      files: mapFiles(),
    },
    resolver: zodResolver(aiMentorLessonFileSchema(t)),
  });

  useEffect(() => {
    if (!areFilesLoading) {
      reset({ files: mapFiles() });
    }
  }, [areFilesLoading, lessonFiles, mapFiles, reset]);

  const files = watch("files") ?? [];
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onSubmit = async (data: AiMentorLessonContextValues) => {
    if (errors.files) return;
    await uploadFiles({ files: data.files as FileWithOptionalId[], lessonId });
    await queryClient.invalidateQueries({
      queryKey: aiMentorLessonFilesQueryOptions(lessonId).queryKey,
    });
  };

  const removeWhere = async ({ fileName, fileSize }: { fileName: string; fileSize: number }) => {
    const fileIndex = files.findIndex((file) => file.name === fileName && file.size === fileSize);
    if (fileIndex === -1) return;

    const deletedFile = files[fileIndex] as FileWithOptionalId;
    const next = files.filter((_, idx) => idx !== fileIndex);

    setValue("files", next, { shouldValidate: true, shouldDirty: true });
    if (inputRef.current) inputRef.current.value = "";

    if (deletedFile.id) {
      await deleteDocumentLink({ documentLinkId: deletedFile.id });
      await queryClient.invalidateQueries({
        queryKey: aiMentorLessonFilesQueryOptions(lessonId).queryKey,
      });
    }

    if (errors.files) {
      await handleSubmit(onSubmit)();
    }
  };

  return (
    <Controller
      control={control}
      name="files"
      render={({ field: { value, onChange, ref } }) => (
        <div className="flex flex-col gap-1">
          <Label className="body-base">
            {t("adminCourseView.curriculum.lesson.field.additionalContext")}
          </Label>
          <Label className="text-sm text-neutral-600">
            {t("adminCourseView.curriculum.lesson.field.includeFiles", {
              count: MAX_NUM_OF_FILES,
              MAX_FILE_SIZE: MAX_MB_PER_FILE,
            })}
          </Label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {!isUploadPending &&
              files.map((item, idx) => (
                <UploadFileCard
                  name={item.name}
                  meta={FILE_TYPES_MAP[item.type] ?? item.type ?? "File"}
                  key={`${item.name} - ${item.type} - ${item.size}`}
                  onRemove={() => removeWhere({ fileName: item.name, fileSize: item.size })}
                  error={idx >= MAX_NUM_OF_FILES}
                />
              ))}
          </div>
          {isUploadPending && (
            <div className="grid w-full place-items-center p-4">
              <FileLoader />
            </div>
          )}

          <Input
            id="file-upload"
            ref={(el) => {
              inputRef.current = el;
              ref && ref(el);
            }}
            type="file"
            multiple
            accept=".pdf,.docx,.txt"
            onChange={async (e) => {
              const fileList = Array.from(e.target.files ?? []);
              const existing = value ?? [];

              const merged = [
                ...existing,
                ...fileList.filter(
                  (newFile) =>
                    !existing.some(
                      (existingFile) =>
                        existingFile.name === newFile.name && existingFile.size === newFile.size,
                    ),
                ),
              ];

              onChange(merged);
              await handleSubmit(onSubmit)();
            }}
            className="sr-only absolute h-0 w-0"
          />

          {!isUploadPending && (
            <Button
              className="mt-2 inline-flex w-fit cursor-pointer items-center justify-center rounded-full border px-4 py-2 text-sm"
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
            >
              Upload files
            </Button>
          )}

          {errors.files && (
            <p className="text-sm text-error-600">
              {errors.files.message || errors.files[0]?.message}
            </p>
          )}
        </div>
      )}
    />
  );
}
