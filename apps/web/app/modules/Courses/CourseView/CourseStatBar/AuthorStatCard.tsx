import { useTranslation } from "react-i18next";

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

const DEFAULT_AUTHOR_IMAGE =
  "https://images.unsplash.com/vector-1756860574486-9e0c75696f6c?q=80&w=1160&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

const getAuthorName = (author?: Author) => {
  if (!author?.firstName && !author?.lastName) return "";
  return `${author.firstName ?? ""} ${author.lastName ?? ""}`.trim();
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
      className={`cursor-pointer rounded-2xl border-l-4 border-[#3f58b6] bg-white p-4 text-left shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl ${
        isAdminExperience
          ? "hover:outline hover:outline-2 hover:outline-dashed hover:outline-[#3f58b6]/40"
          : ""
      } ${isAdminExperience && !showAuthorSection ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-4">
        <img
          src={author?.profilePictureUrl ?? DEFAULT_AUTHOR_IMAGE}
          alt={authorName || "author picture"}
          className="h-12 w-12 flex-shrink-0 rounded-full object-cover"
        />
        <div className="flex-1">
          <p className="mb-0.5 text-xs uppercase tracking-wider text-[#676767]">
            {t("modernCourseView.stats.aboutAuthor")}
          </p>
          <p className="text-lg font-bold text-[#363636]">{authorName}</p>
          <p className="text-xs text-[#676767]">{author?.jobTitle}</p>
        </div>
      </div>
    </button>
  );
}
