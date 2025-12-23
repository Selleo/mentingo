import { useNavigate, useParams } from "@remix-run/react";
import { ACCESS_GUARD } from "@repo/shared";
import { formatDate } from "date-fns";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { useDeleteNews } from "~/api/mutations";
import { useNews } from "~/api/queries";
import { Icon } from "~/components/Icon";
import { PageWrapper } from "~/components/PageWrapper";
import Viewer from "~/components/RichText/Viever";
import { TOC } from "~/components/TOC/TOC";
import { Button } from "~/components/ui/button";
import { ContentAccessGuard } from "~/Guards/AccessGuard";
import { useUserRole } from "~/hooks/useUserRole";
import { cn } from "~/lib/utils";

import Loader from "../common/Loader/Loader";
import { useLanguageStore } from "../Dashboard/Settings/Language/LanguageStore";

export default function NewsDetailsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { newsId } = useParams();

  const { language } = useLanguageStore();
  const { isAdminLike } = useUserRole();
  const { data: news, isLoading: isLoadingNews } = useNews(
    newsId!,
    { language },
    { enabled: Boolean(newsId) },
  );
  const { mutateAsync: deleteNews } = useDeleteNews();

  const [contentWithIds, setContentWithIds] = useState(news?.plainContent ?? "");
  const handleContentWithIds = useCallback((html: string) => setContentWithIds(html || ""), []);

  if (isLoadingNews) {
    return (
      <ContentAccessGuard type={ACCESS_GUARD.UNREGISTERED_NEWS_ACCESS}>
        <PageWrapper>
          <div className="py-10 flex justify-center">
            <Loader />
          </div>
        </PageWrapper>
      </ContentAccessGuard>
    );
  }

  if (!news) {
    return (
      <ContentAccessGuard type={ACCESS_GUARD.UNREGISTERED_NEWS_ACCESS}>
        <PageWrapper>
          <div className="py-10 text-center text-neutral-700">{t("newsView.notFound")}</div>
        </PageWrapper>
      </ContentAccessGuard>
    );
  }

  const headerImageUrl = news.resources?.coverImage?.fileUrl;
  const publishedDate = news.publishedAt ? new Date(news.publishedAt) : null;

  return (
    <ContentAccessGuard type={ACCESS_GUARD.UNREGISTERED_NEWS_ACCESS}>
      <PageWrapper
        breadcrumbs={[
          { title: t("navigationSideBar.dashboard"), href: "/" },
          { title: t("navigationSideBar.news"), href: "/news" },
          { title: news.title, href: `/news/${news.id}` },
        ]}
        className="flex flex-col gap-10 bg-neutral-50/80"
        rightSideContent={
          <TOC contentHtml={news.content} onContentWithIds={handleContentWithIds} />
        }
      >
        {isAdminLike && (
          <div className="flex justify-end gap-2 max-w-6xl mx-auto w-full">
            <Button
              variant="outline"
              className="w-28 gap-2"
              onClick={() => {
                navigate(`/news/${news.id}/edit`);
              }}
            >
              <Icon name="Edit" className="size-4" />
              <span className="text-sm font-semibold leading-5 text-neutral-800">
                {t("newsView.edit")}
              </span>
            </Button>
            <Button
              variant="outline"
              className="w-28 gap-2"
              onClick={async () => {
                if (!newsId) return;

                await deleteNews(
                  { id: newsId },
                  {
                    onSuccess: () => {
                      navigate("/news");
                    },
                  },
                );
              }}
            >
              <Icon name="TrashIcon" className="size-4" />
              <span className="text-sm font-semibold leading-5 text-neutral-800">
                {t("newsView.button.delete")}
              </span>
            </Button>
          </div>
        )}

        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 bg-white rounded-3xl mb-8">
          {headerImageUrl ? (
            <div className="overflow-hidden bg-white rounded-t-3xl px-10 pt-10 pb-6">
              <img
                src={headerImageUrl}
                alt={news.title}
                className="h-[380px] w-full object-cover md:h-[480px] rounded-3xl"
              />
            </div>
          ) : null}

          <div
            className={cn("flex flex-col gap-5 border-b border-neutral-200 pb-8 px-10", {
              "pt-10": !headerImageUrl,
            })}
          >
            <h1 className="text-[40px] font-bold leading-[1.1] text-neutral-950">{news.title}</h1>
            <p className="text-lg font-normal leading-8 text-neutral-700">{news.summary}</p>
            <div className="flex flex-wrap items-center gap-3 text-sm font-normal leading-5 text-neutral-700">
              <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1 shadow-sm ring-1 ring-neutral-100">
                <Icon name="Calendar" className="text-neutral-600 size-4" />
                <p className="text-neutral-800">
                  {publishedDate ? formatDate(publishedDate, "d MMMM yyyy") : "-"}
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1 shadow-sm ring-1 ring-neutral-100">
                <Icon name="User" className="text-neutral-600 size-4" />
                <p className="text-neutral-800">{news.authorName}</p>
              </div>
            </div>
          </div>

          {news.content ? (
            <Viewer variant="news" content={contentWithIds || news.content} className="px-10" />
          ) : null}

          <div className="mx-auto w-full border-b border-primary-100" />

          <div className="mx-auto flex w-full items-center justify-between pb-6 px-6">
            <Button
              variant="ghost"
              className="flex items-center gap-2 select-none disabled:opacity-50"
              onClick={() => {
                navigate(`/news/${news.previousNews}`);
              }}
              disabled={!news.previousNews}
            >
              <Icon name="ChevronLeft" className="size-5 text-neutral-800" />
              <span className="text-sm font-semibold leading-5 text-neutral-800">
                {t("newsView.previousNews")}
              </span>
            </Button>
            <Button
              variant="ghost"
              className="flex items-center gap-2 select-none disabled:opacity-50"
              onClick={() => {
                navigate(`/news/${news.nextNews}`);
              }}
              disabled={!news.nextNews}
            >
              <span className="text-sm font-semibold leading-5 text-neutral-800">
                {t("newsView.nextNews")}
              </span>
              <Icon name="ChevronRight" className="size-5 text-neutral-800" />
            </Button>
          </div>
        </div>
      </PageWrapper>
    </ContentAccessGuard>
  );
}
