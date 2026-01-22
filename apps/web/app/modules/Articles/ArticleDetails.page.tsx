import { useNavigate, useParams } from "@remix-run/react";
import { ACCESS_GUARD } from "@repo/shared";
import { format } from "date-fns";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useDeleteArticle } from "~/api/mutations/useDeleteArticle";
import { useCurrentUser } from "~/api/queries";
import { useArticle } from "~/api/queries/useArticle";
import { Icon } from "~/components/Icon";
import { PageWrapper } from "~/components/PageWrapper";
import Viewer from "~/components/RichText/Viever";
import { TOC } from "~/components/TOC/TOC";
import { Button } from "~/components/ui/button";
import { useVideoPlayer } from "~/components/VideoPlayer/VideoPlayerContext";
import { ContentAccessGuard } from "~/Guards/AccessGuard";
import { useUserRole } from "~/hooks/useUserRole";
import { cn } from "~/lib/utils";

import Loader from "../common/Loader/Loader";
import { useLanguageStore } from "../Dashboard/Settings/Language/LanguageStore";

import { DeleteArticleDialog } from "./components/DeleteArticleDialog";

export default function ArticleDetailsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { clearVideo } = useVideoPlayer();

  const { articleId } = useParams();

  const { language } = useLanguageStore();

  const { data: currentUser } = useCurrentUser();

  const { isAdmin } = useUserRole();
  const { data: article, isLoading: isLoadingArticle } = useArticle(articleId ?? "", language);
  const { mutate: deleteArticle, isPending: isDeleting } = useDeleteArticle();

  const [contentWithIds, setContentWithIds] = useState("");

  const handleContentWithIds = useCallback((html: string) => setContentWithIds(html || ""), []);

  useEffect(() => {
    if (article?.id) {
      clearVideo();
    }

    return () => {
      clearVideo();
    };
  }, [article?.id, clearVideo]);

  if (isLoadingArticle) {
    return (
      <ContentAccessGuard type={ACCESS_GUARD.UNREGISTERED_ARTICLES_ACCESS}>
        <PageWrapper>
          <div className="py-10 flex justify-center">
            <Loader />
          </div>
        </PageWrapper>
      </ContentAccessGuard>
    );
  }

  if (!article) {
    return (
      <ContentAccessGuard type={ACCESS_GUARD.UNREGISTERED_ARTICLES_ACCESS}>
        <PageWrapper>
          <div className="py-10 text-center text-neutral-700">{t("articlesView.notFound")}</div>
        </PageWrapper>
      </ContentAccessGuard>
    );
  }

  const canEdit = isAdmin || currentUser?.id === article?.authorId;

  const headerImageUrl = article.resources?.coverImage?.fileUrl;
  const publishedDate = article.publishedAt ? new Date(article.publishedAt) : null;

  return (
    <ContentAccessGuard type={ACCESS_GUARD.UNREGISTERED_ARTICLES_ACCESS}>
      <PageWrapper
        breadcrumbs={[
          { title: t("navigationSideBar.articles"), href: "/articles" },
          { title: article.title, href: `/articles/${article.id}` },
        ]}
        className="flex flex-col gap-10 bg-gray-50 min-h-dvh"
        rightSideContent={
          <TOC contentHtml={article.content} onContentWithIds={handleContentWithIds} />
        }
      >
        {canEdit && (
          <div className="flex justify-end gap-2 max-w-6xl mx-auto w-full">
            <Button
              variant="outline"
              className="w-28 gap-2"
              onClick={() => {
                navigate(`/articles/${article.id}/edit`);
              }}
            >
              <Icon name="Edit" className="size-4" />
              <span className="text-sm font-semibold leading-5 text-neutral-800">
                {t("common.button.edit")}
              </span>
            </Button>
            <DeleteArticleDialog
              articleId={articleId}
              isDeleting={isDeleting}
              onDelete={(id) => deleteArticle(id)}
            />
          </div>
        )}

        <div className="mx-auto flex w-full py-8 max-w-6xl flex-col gap-4 bg-neutral">
          <div
            className={cn("flex flex-col gap-5 border-b pb-4 border-neutral-200", {
              "pt-10": !headerImageUrl,
            })}
          >
            <h1 className="text-[40px] font-bold leading-[1.1] text-neutral-950">
              {article.title}
            </h1>
            <p className="text-lg font-normal leading-8 text-neutral-700">{article.summary}</p>
            <div className="flex flex-wrap items-center gap-1 text-sm font-normal leading-5 text-neutral-700">
              <div className="flex items-center gap-2 px-3 py-1">
                <Icon name="User" className="text-neutral-600 size-4" />
                <p className="text-neutral-800">{article.authorName}</p>
              </div>
              <div className="flex items-center gap-2 px-3 py-1">
                <Icon name="Calendar" className="text-neutral-600 size-4" />
                <p className="text-neutral-800">
                  {publishedDate ? format(publishedDate, "d MMMM yyyy") : "-"}
                </p>
              </div>
            </div>
          </div>

          {headerImageUrl ? (
            <div className="overflow-hidden bg-white rounded-t-3xl mt-2 pb-6">
              <img
                src={headerImageUrl}
                alt={article.title}
                className="h-[380px] w-full object-cover md:h-[480px] rounded-3xl"
              />
            </div>
          ) : null}

          {contentWithIds || article.content ? (
            <Viewer
              variant="content"
              content={contentWithIds || article.content}
              className="mt-4"
            />
          ) : null}

          <div className="mx-auto w-full border-b border-primary-100" />

          <div className="mx-auto flex w-full items-center justify-between pb-6 px-6">
            <Button
              variant="ghost"
              className="flex items-center gap-2 select-none disabled:opacity-50"
              onClick={() => {
                if (!article.previousArticle) return;
                navigate(`/articles/${article.previousArticle}`);
              }}
              disabled={!article.previousArticle}
            >
              <Icon name="ChevronLeft" className="size-5 text-neutral-800" />
              <span className="text-sm font-semibold leading-5 text-neutral-800">
                {t("articlesView.previousArticle")}
              </span>
            </Button>
            <Button
              variant="ghost"
              className="flex items-center gap-2 select-none disabled:opacity-50"
              onClick={() => {
                if (!article.nextArticle) return;
                navigate(`/articles/${article.nextArticle}`);
              }}
              disabled={!article.nextArticle}
            >
              <span className="text-sm font-semibold leading-5 text-neutral-800">
                {t("articlesView.nextArticle")}
              </span>
              <Icon name="ChevronRight" className="size-5 text-neutral-800" />
            </Button>
          </div>
        </div>
      </PageWrapper>
    </ContentAccessGuard>
  );
}
