import { cn } from "~/lib/utils";
import { UploadFileCard } from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/AiMentorLessonForm/components/UploadFileCard";

import type { GetCourseGenerationFilesResponse } from "~/api/generated-api";

type CourseGenerationFileListProps = {
  files: GetCourseGenerationFilesResponse;
  onRemoveFile: (documentId: string) => void;
  disableRemove?: boolean;
  className?: string;
};

function getFileTypeLabel(contentType: string) {
  if (contentType.includes("pdf")) return "PDF document";
  if (contentType.includes("wordprocessingml")) return "DOCX document";
  if (contentType.includes("markdown")) return "Markdown file";
  if (contentType.includes("text")) return "Text file";
  return contentType || "File";
}

export function CourseGenerationFileList({
  files,
  onRemoveFile,
  disableRemove = false,
  className,
}: CourseGenerationFileListProps) {
  if (!files.length) return null;

  return (
    <div className={cn("mt-3", className)}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {files.map((file) => (
          <UploadFileCard
            key={file.id}
            name={file.filename}
            meta={getFileTypeLabel(file.contentType)}
            onRemove={() => onRemoveFile(file.id)}
            compact
            removeDisabled={disableRemove}
          />
        ))}
      </div>
    </div>
  );
}
