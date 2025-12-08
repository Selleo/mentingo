import { useSearchParams } from "@remix-run/react";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";

import { PageWrapper } from "../../components/PageWrapper";
import { Pagination } from "../../components/Pagination/Pagination";

import NewsItem from "./NewsItem";
import { getPaginationData } from "./utils";

const mockedNews = Array.from({ length: 20 }).map((_, idx) => ({
  id: idx + 1,
  title: `Sample News Title ${idx + 1}`,
  introduction: `This is the introduction for news item ${idx + 1}. It gives a brief overview of the news content.`,
  author: `Author ${(idx % 5) + 1}`,
  createdAt: new Date(Date.now() - idx * 1000 * 60 * 60 * 24).toISOString(),
  image: `https://picsum.photos/seed/news${idx + 1}/400/200`,
  content: `This is the main content of news item ${idx + 1}. It contains all the details, story text, and any relevant information for this news post. It may be long or short, depending on the topic covered.`,
}));

function NewsPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const parsePageParam = useCallback(() => {
    const pageParam = Number(searchParams.get("page"));
    return Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  }, [searchParams]);

  const [currentPage, setCurrentPage] = useState<number>(() => parsePageParam());

  const totalItems = mockedNews.length;
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
    const pageNews = mockedNews.slice(startItem - 1, endItem);

    if (currentPage === 1 && pageNews.length) {
      const [firstNews, ...moreNews] = pageNews;

      return (
        <>
          <h1 className="h1">{t("newsView.header")}</h1>

          <NewsItem {...firstNews} isBig />

          {/* TODO: deleted more news heading, ask if that's okay */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {moreNews.map((news) => (
              <NewsItem key={news.id} {...news} />
            ))}
          </div>
        </>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
        {pageNews.map((news) => (
          <NewsItem key={news.id} {...news} />
        ))}
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

      <Pagination
        className="border-t"
        totalItems={totalItems}
        overrideTotalPages={totalPages}
        startItemOverride={startItem}
        endItemOverride={endItem}
        itemsPerPage={itemsPerPage}
        currentPage={currentPage}
        canChangeItemsPerPage={false}
        onPageChange={changePage}
      />
    </PageWrapper>
  );
}

export default NewsPage;
