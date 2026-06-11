import { Link } from "@remix-run/react";
import { FileText } from "lucide-react";

import type { GetLessonsResponse } from "~/api/generated-api";

export const LessonEntry = ({
  item,
  onSelect,
}: {
  item: GetLessonsResponse["data"][number];
  onSelect: () => void;
}) => {
  return (
    <Link
      to={`/course/${item.courseId}/lesson/${item.id}`}
      onClick={onSelect}
      className="group focus:outline-none focus-visible:outline-none"
    >
      <li className="rounded-md px-2 py-1.5 text-sm text-neutral-800 hover:bg-primary-50 group-focus:bg-primary-100">
        <span className="line-clamp-1">{item.title}</span>
        {item.matchedAttachmentFileName && (
          <span className="mt-0.5 flex min-w-0 items-center gap-1 text-xs leading-4 text-neutral-600">
            <FileText className="size-3.5 shrink-0" aria-hidden />
            <span className="line-clamp-1 leading-4 block py-1">
              {item.matchedAttachmentFileName}
            </span>
          </span>
        )}
      </li>
    </Link>
  );
};
