import { useTranslation } from "react-i18next";

import { UserAvatar } from "~/components/UserProfile/UserAvatar";
import { cn } from "~/lib/utils";

import { COURSE_OVERVIEW_HANDLES } from "../../../../../e2e/data/courses/handles";

import { getAuthorName } from "./author.utils";

type Author = {
  firstName?: string | null;
  jobTitle?: string | null;
  lastName?: string | null;
  profilePictureUrl?: string | null;
};

type AuthorStatCardProps = {
  author?: Author;
  isAdminExperience: boolean;
  onOpen: () => void;
  showAuthorSection: boolean;
};

export default function AuthorStatCard({
  author,
  isAdminExperience,
  onOpen,
  showAuthorSection,
}: AuthorStatCardProps) {
  const { t } = useTranslation();
  const authorName = getAuthorName(author);

  return (
    <button
      type="button"
      data-testid={COURSE_OVERVIEW_HANDLES.AUTHOR_CARD}
      onClick={onOpen}
      className={cn(
        "relative cursor-pointer overflow-hidden rounded-2xl bg-white p-4 pl-6 text-left shadow-sm transition-all hover:bg-neutral-50 hover:shadow-xl",
        {
          "opacity-50 hover:bg-neutral-100 hover:opacity-75":
            isAdminExperience && !showAuthorSection,
        },
      )}
    >
      <div className="absolute inset-y-0 left-0 w-1.5 bg-primary-700" aria-hidden="true" />
      <div className="flex items-center gap-4">
        <UserAvatar
          userName={authorName}
          profilePictureUrl={author?.profilePictureUrl}
          className="size-12 min-h-12 min-w-12 max-h-12 max-w-12 flex-none"
        />
        <div className="min-w-0 flex-1">
          <p className="mb-0.5 text-xs uppercase tracking-wider text-neutral-800">
            {t("modernCourseView.stats.aboutAuthor")}
          </p>
          <p className="text-lg font-bold text-neutral-950">{authorName}</p>
          <p className="text-xs text-neutral-800">{author?.jobTitle}</p>
        </div>
      </div>
    </button>
  );
}
