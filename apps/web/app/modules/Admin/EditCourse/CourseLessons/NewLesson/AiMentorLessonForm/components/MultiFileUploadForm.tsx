import { zodResolver } from "@hookform/resolvers/zod";
import { useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

import {
  type AiMentorLessonContextValues,
  aiMentorLessonFileSchema,
} from "../validators/useAiMentorLessonFormSchema";

const FILE_TYPES_MAP: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "text/plain": "TXT",
};

interface FileCardProps {
  name: string;
  fileType: string;
  onRemove: () => void;
}

const FileCard = ({ name, fileType, onRemove }: FileCardProps) => (
  <div className="relative flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
    <button
      type="button"
      aria-label="Remove file"
      onClick={onRemove}
      className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 shadow-sm hover:bg-neutral-50 hover:text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-300 focus:ring-offset-1"
    >
      <Icon name="IconX" className="size-4" />
    </button>

    <div className="flex size-10 flex-none items-center justify-center rounded-md bg-neutral-50 text-neutral-500">
      <Icon name="Directory" className="size-6" />
    </div>

    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium text-neutral-900" title={name}>
        {name}
      </p>
      <p className="text-xs text-neutral-500">{FILE_TYPES_MAP[fileType] ?? fileType ?? "File"}</p>
    </div>
  </div>
);

export function MultiFileUploadForm() {
  const { t } = useTranslation();

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AiMentorLessonContextValues>({
    defaultValues: { files: [] },
    resolver: zodResolver(aiMentorLessonFileSchema),
  });

  const files = watch("files");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onSubmit = async (data: AiMentorLessonContextValues) => {
    const formData = new FormData();
    data.files.forEach((f) => formData.append("files", f));
  };

  const removeAt = async (index: number) => {
    const next = files.filter((_, i) => i !== index);
    setValue("files", next, { shouldValidate: true, shouldDirty: true });
    if (inputRef.current) inputRef.current.value = "";
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
            {t("adminCourseView.curriculum.lesson.field.includeFiles")}
          </Label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {files.map((item, idx) => (
              <FileCard
                name={item.name}
                fileType={item.type}
                key={idx}
                onRemove={() => removeAt(idx)}
              />
            ))}
          </div>

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

          <Button
            className="mt-2 inline-flex w-fit cursor-pointer items-center justify-center rounded-full border px-4 py-2 text-sm"
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
          >
            Upload files
          </Button>

          {!!errors.files && <p className="text-sm text-error-600">{errors.files?.message}</p>}
        </div>
      )}
    />
  );
}
