import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

import { DEFAULT_AUTHOR_STAT_IMAGE, getAuthorName } from "./author.utils";

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
      onClick={onOpen}
      className={cn(
        "cursor-pointer rounded-2xl border-l-4 border-primary-700 bg-white p-4 text-left shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl",
        {
          "hover:outline hover:outline-2 hover:outline-dashed hover:outline-primary-700/40":
            isAdminExperience,
          "opacity-50": isAdminExperience && !showAuthorSection,
        },
      )}
    >
      <div className="flex items-center gap-4">
        <img
          src={author?.profilePictureUrl ?? DEFAULT_AUTHOR_STAT_IMAGE}
          alt={authorName || "author picture"}
          className="h-12 w-12 flex-shrink-0 rounded-full object-cover"
        />
        <div className="flex-1">
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
