import { useNavigate, useSearchParams } from "@remix-run/react";
import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useCreateNews } from "../../api/mutations";
import { useNewsList } from "../../api/queries";
import { Icon } from "../../components/Icon";
import { PageWrapper } from "../../components/PageWrapper";
import { Pagination } from "../../components/Pagination/Pagination";
import { Button } from "../../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { useUserRole } from "../../hooks/useUserRole";
import Loader from "../common/Loader/Loader";
import { useLanguageStore } from "../Dashboard/Settings/Language/LanguageStore";

import NewsItem from "./NewsItem";
import { ITEMS_ON_FIRST_PAGE, ITEMS_ON_OTHER_PAGES } from "./utils";

function NewsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const parsePageParam = useCallback(() => {
    const pageParam = Number(searchParams.get("page"));
    return Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  }, [searchParams]);

  const [currentPage, setCurrentPage] = useState<number>(() => parsePageParam());
  const [statusFilter, setStatusFilter] = useState<"published" | "draft">("published");

  const { mutateAsync: createNews } = useCreateNews();
  const { isAdminLike } = useUserRole();
  const { language } = useLanguageStore();
  const itemsPerPage = currentPage === 1 ? ITEMS_ON_FIRST_PAGE : ITEMS_ON_OTHER_PAGES;
  const { data: newsList, isLoading: isLoadingNewsList } = useNewsList({
    language,
    page: currentPage,
    perPage: itemsPerPage,
  });

  const filteredNews = useMemo(() => {
    const data = newsList?.data ?? [];
    if (!isAdminLike) return data;
    return data.filter((item) => item.status === statusFilter);
  }, [newsList?.data, isAdminLike, statusFilter]);

  const filteredTotalItems = filteredNews.length;

  const remainingAfterFirst = Math.max(filteredTotalItems - ITEMS_ON_FIRST_PAGE, 0);
  const extraPages = Math.ceil(remainingAfterFirst / ITEMS_ON_OTHER_PAGES);
  const totalPages = filteredTotalItems > 0 ? 1 + extraPages : 1;
  const startItem =
    filteredTotalItems > 0
      ? currentPage === 1
        ? 1
        : ITEMS_ON_FIRST_PAGE + (currentPage - 2) * ITEMS_ON_OTHER_PAGES + 1
      : 0;
  const endItem =
    filteredTotalItems > 0
      ? currentPage === 1
        ? Math.min(ITEMS_ON_FIRST_PAGE, filteredTotalItems)
        : Math.min(
            ITEMS_ON_FIRST_PAGE + (currentPage - 1) * ITEMS_ON_OTHER_PAGES,
            filteredTotalItems,
          )
      : 0;

  const changePage = (newPage: number) => {
    const clamped = Math.min(Math.max(newPage, 1), totalPages);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", String(clamped));
    setSearchParams(nextParams);
    setCurrentPage(clamped);
  };

  const createEmptyNews = useCallback(async () => {
    await createNews(
      { language },
      {
        onSuccess: (data) => {
          navigate("/news/add", {
            state: {
              createdNewsId: data.data.id,
            },
          });
        },
      },
    );
  }, [createNews, language, navigate]);

  const renderNewsContent = useCallback(() => {
    const pageNews = filteredNews ?? [];

    if (currentPage === 1) {
      const [firstNews, ...moreNews] = pageNews ?? [];

      return (
        <>
          <div className="flex items-center justify-between pb-10">
            <h1 className="h4">{t("newsView.header")}</h1>
            <div className="flex items-center gap-3">
              {isAdminLike && (
                <Select
                  value={statusFilter}
                  onValueChange={(value) => {
                    const next = value as "published" | "draft";
                    setStatusFilter(next);
                    const nextParams = new URLSearchParams(searchParams);
                    nextParams.set("page", "1");
                    setSearchParams(nextParams);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="published">{t("newsView.status.published")}</SelectItem>
                    <SelectItem value="draft">{t("newsView.status.draft")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {isAdminLike && (
                <Button
                  className="flex items-center justify-center rounded-full w-12 h-12"
                  variant="outline"
                  onClick={createEmptyNews}
                >
                  <Icon name="Plus" className="size-4" />
                </Button>
              )}
            </div>
          </div>

          {firstNews || moreNews.length ? (
            <>
              <NewsItem {...firstNews} isBig className="mb-6" />

              {moreNews.length ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 mb-6">
                  {moreNews.map((news: (typeof filteredNews)[number]) => (
                    <NewsItem key={news.id} {...news} />
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <h3 className="body-base-md">No news</h3>
            </div>
          )}
        </>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 mb-6">
        {pageNews?.map((news: (typeof filteredNews)[number]) => (
          <NewsItem key={news.id} {...news} />
        ))}
      </div>
    );
  }, [
    filteredNews,
    currentPage,
    t,
    isAdminLike,
    statusFilter,
    searchParams,
    setSearchParams,
    createEmptyNews,
  ]);

  if (isLoadingNewsList) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader />
      </div>
    );
  }

  return (
    <PageWrapper
      breadcrumbs={[
        {
          title: t("adminUsersView.breadcrumbs.dashboard"),
          href: "/",
        },
        {
          title: t("adminUsersView.breadcrumbs.news"),
          href: "/news",
        },
      ]}
      className="flex flex-col"
    >
      {renderNewsContent()}

      {filteredTotalItems > 0 ? (
        <Pagination
          className="border-t"
          totalItems={filteredTotalItems}
          overrideTotalPages={totalPages}
          startItemOverride={startItem}
          endItemOverride={endItem}
          itemsPerPage={itemsPerPage as 7}
          currentPage={currentPage}
          canChangeItemsPerPage={false}
          onPageChange={changePage}
        />
      ) : null}
    </PageWrapper>
  );
}

export default NewsPage;
