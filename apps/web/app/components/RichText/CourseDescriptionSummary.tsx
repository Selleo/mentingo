import { sanitizeRichTextSummary } from "@repo/shared";

export const CourseDescriptionSummary = ({
  content,
  className,
}: {
  content: string;
  className?: string;
}) => (
  <div
    className={className}
    dangerouslySetInnerHTML={{ __html: sanitizeRichTextSummary(content) }}
  />
);
