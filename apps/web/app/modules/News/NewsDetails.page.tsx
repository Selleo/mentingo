import { useNavigate, useParams } from "@remix-run/react";
import { formatDate } from "date-fns";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useDeleteNews } from "../../api/mutations";
import { useNews } from "../../api/queries";
import { Icon } from "../../components/Icon";
import { PageWrapper } from "../../components/PageWrapper";
import Viewer from "../../components/RichText/Viever";
import { TOC } from "../../components/TOC/TOC";
import { Button } from "../../components/ui/button";
import { useUserRole } from "../../hooks/useUserRole";
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

  const [contentWithIds, setContentWithIds] = useState(news?.content ?? "");

  if (isLoadingNews) {
    return (
      <PageWrapper>
        <div className="py-10 flex justify-center">
          <Loader />
        </div>
      </PageWrapper>
    );
  }

  if (!news) {
    return (
      <PageWrapper>
        <div className="py-10 text-center text-neutral-700">{t("newsView.notFound")}</div>
      </PageWrapper>
    );
  }

  const headerImageUrl = news.resources?.coverImage?.fileUrl;
  const publishedDate = news.publishedAt ? new Date(news.publishedAt) : null;

  return (
    <PageWrapper
      breadcrumbs={[
        { title: t("navigationSideBar.dashboard"), href: "/" },
        { title: t("navigationSideBar.news"), href: "/news" },
        { title: news.title, href: `/news/${news.id}` },
      ]}
      className="flex flex-col gap-6"
      sideContent={
        <TOC
          contentHtml={news.content}
          onContentWithIds={(html) => setContentWithIds(html || "")}
        />
      }
    >
      <div className="flex flex-col gap-8">
        {isAdminLike && (
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              className="w-28 gap-2"
              onClick={() => {
                navigate(`edit`);
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
              onClick={() => {
                if (!newsId) return;

                deleteNews(
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

        {headerImageUrl ? (
          <img
            src={headerImageUrl}
            alt={news.title}
            className="w-full h-[500px] rounded-lg object-cover"
          />
        ) : null}

        <div className="flex flex-col gap-4 border-b-[1px] border-primary-100 pb-3">
          <h1 className="text-[42px] font-bold text-neutral-950 leading-10">{news.title}</h1>
          <p className="text-lg font-normal text-neutral-800 leading-7">{news.summary}</p>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Icon name="Calendar" className="text-neutral-600 size-4" />
              <p className="text-sm font-normal leading-5 text-neutral-600">
                {publishedDate ? formatDate(publishedDate, "d MMMM yyyy") : "-"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="User" className="text-neutral-600 size-4" />
              <p className="text-sm font-normal leading-5 text-neutral-600">{news.authorName}</p>
            </div>
          </div>
        </div>
      </div>

      <header className="space-y-3">
        <p className="subtle text-neutral-700">{news.summary}</p>
      </header>

      {news.content ? (
        <div className="flex flex-col gap-6">
          <Viewer variant="lesson" content={contentWithIds} />
        </div>
      ) : null}

      <div className="border-b border-primary-100" />

      <div className="flex items-center justify-between pb-14">
        <button
          className="flex items-center gap-2 disabled:opacity-50"
          onClick={() => {
            // navigate(`/news/id`);
          }}
          disabled={false}
        >
          <Icon name="ChevronLeft" className="size-5 text-neutral-800" />
          <span className="text-sm font-semibold leading-5 text-neutral-800">
            {t("newsView.previousNews")}
          </span>
        </button>
        <button
          className="flex items-center gap-2 disabled:opacity-50"
          onClick={() => {
            // navigate(`/news/id`);
          }}
          disabled={true}
        >
          <span className="text-sm font-semibold leading-5 text-neutral-800">
            {t("newsView.nextNews")}
          </span>
          <Icon name="ChevronRight" className="size-5 text-neutral-800" />
        </button>
      </div>
    </PageWrapper>
  );
}
