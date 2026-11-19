import { Link } from "@remix-run/react";
import { formatDistanceToNow } from "date-fns";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { getDateLocale } from "~/utils/getDateLocale";

import { FORUM_HANDLES } from "../../../../e2e/data/forum/handles";
import { getForumCourseDiscussionPath } from "../forum.utils";

import type { ForumCourseDiscussion } from "~/api/queries/forum/forumTypes";

type ForumCourseDiscussionListItemProps = {
  courseDiscussion: ForumCourseDiscussion;
};

export function ForumCourseDiscussionListItem({
  courseDiscussion,
}: ForumCourseDiscussionListItemProps) {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);

  return (
    <Link
      to={getForumCourseDiscussionPath(courseDiscussion.courseId)}
      className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-primary-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
      data-testid={FORUM_HANDLES.courseDiscussion(courseDiscussion.courseId)}
    >
      <span className="body-sm-md min-w-0 flex-1 truncate text-neutral-950">
        {courseDiscussion.courseTitle}
      </span>
      <span className="shrink-0 text-xs text-neutral-600">
        {t("forum.courseDiscussions.messages", { count: courseDiscussion.messageCount })}
      </span>
      {courseDiscussion.lastActivityAt && (
        <span className="hidden shrink-0 text-xs text-neutral-600 sm:inline">
          {formatDistanceToNow(new Date(courseDiscussion.lastActivityAt), {
            addSuffix: true,
            locale: getDateLocale(language),
          })}
        </span>
      )}
      <ChevronRight className="size-4 shrink-0 text-neutral-500" aria-hidden />
    </Link>
  );
}
