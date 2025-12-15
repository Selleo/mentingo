import { useNavigate, useSearchParams } from "@remix-run/react";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";

import { useNewsList } from "~/api/queries";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { useUserRole } from "~/hooks/useUserRole";

import { PageWrapper } from "../../components/PageWrapper";
import { Pagination } from "../../components/Pagination/Pagination";
import Loader from "../common/Loader/Loader";
import { useLanguageStore } from "../Dashboard/Settings/Language/LanguageStore";

import NewsItem from "./NewsItem";
import { getPaginationData, ITEMS_ON_FIRST_PAGE, ITEMS_ON_OTHER_PAGES } from "./utils";

function NewsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const parsePageParam = useCallback(() => {
    const pageParam = Number(searchParams.get("page"));
    return Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  }, [searchParams]);

  const [currentPage, setCurrentPage] = useState<number>(() => parsePageParam());

  const { isAdminLike } = useUserRole();
  const { language } = useLanguageStore();
  const { data: newsList, isLoading: isLoadingNewsList } = useNewsList({
    language,
    page: currentPage,
    perPage: currentPage === 1 ? ITEMS_ON_FIRST_PAGE : ITEMS_ON_OTHER_PAGES,
  });

  const totalItems = newsList?.length ?? 0;
  const { totalPages, itemsPerPage, startItem, endItem } = useMemo(
    () => getPaginationData(totalItems, currentPage),
    [currentPage, totalItems],
  );

  const changePage = (newPage: number) => {
    const clamped = Math.min(Math.max(newPage, 1), totalPages);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("page", String(clamped));
    setSearchParams(nextParams);
    setCurrentPage(clamped);
  };

  const renderNewsContent = () => {
    const pageNews = newsList?.slice(startItem - 1, endItem);

    if (currentPage === 1) {
      const [firstNews, ...moreNews] = pageNews ?? [];

      return (
        <>
          <div className="flex items-center justify-between">
            <h1 className="h1">{t("newsView.header")}</h1>
            {isAdminLike && (
              <Button
                className="flex items-center justify-center rounded-full w-12 h-12"
                variant="outline"
                onClick={() => {
                  navigate("/news/add");
                }}
              >
                <Icon name="Plus" className="size-4" />
              </Button>
            )}
          </div>

          {firstNews || moreNews.length ? (
            <>
              <NewsItem {...firstNews} isBig />

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {moreNews.map((news) => (
                  <NewsItem key={news.id} {...news} />
                ))}
              </div>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
        {pageNews?.map((news) => <NewsItem key={news.id} {...news} />)}
      </div>
    );
  };

  useEffect(() => {
    const pageFromUrl = parsePageParam();
    const clamped = Math.min(Math.max(pageFromUrl, 1), totalPages);
    if (clamped !== currentPage) {
      setCurrentPage(clamped);
    }
  }, [currentPage, totalPages, parsePageParam]);

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
      className="flex flex-col gap-8"
    >
      {renderNewsContent()}

      {totalItems > 0 ? (
        <Pagination
          className="border-t"
          totalItems={totalItems}
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
