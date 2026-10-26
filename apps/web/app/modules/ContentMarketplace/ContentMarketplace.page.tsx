import { CONTENT_MARKETPLACE_SORT, type ContentMarketplaceSort } from "@repo/shared";
import { History, LayoutGrid } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useContentMarketplaceFilterOptions } from "~/api/queries/useContentMarketplaceFilterOptions";
import { useContentMarketplaceListings } from "~/api/queries/useContentMarketplaceListings";
import { PageWrapper } from "~/components/PageWrapper";
import { Pagination } from "~/components/Pagination/Pagination";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useDebounce } from "~/hooks/useDebounce";

import { ContentMarketplaceFilters } from "./components/ContentMarketplaceFilters";
import { ContentMarketplaceListingCard } from "./components/ContentMarketplaceListingCard";
import { ContentMarketplaceSpotlight } from "./components/ContentMarketplaceSpotlight";
import {
  ContentMarketplaceEmpty,
  ContentMarketplaceError,
  ContentMarketplaceLoading,
} from "./components/ContentMarketplaceStates";
import {
  CONTENT_MARKETPLACE_FILTER_ALL,
  CONTENT_MARKETPLACE_PAGE_SIZE,
  CONTENT_MARKETPLACE_PATH,
  CONTENT_MARKETPLACE_RECENT_QUERY,
} from "./contentMarketplace.constants";
import { ContentMarketplaceGate } from "./ContentMarketplaceGate";
import {
  findContentMarketplaceDuration,
  findContentMarketplaceSort,
  toContentMarketplaceCategoryQuery,
} from "./utils/contentMarketplaceQuery.utils";

function ContentMarketplaceListings() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ContentMarketplaceSort>(CONTENT_MARKETPLACE_SORT.RECENT);
  const [category, setCategory] = useState(CONTENT_MARKETPLACE_FILTER_ALL);
  const [duration, setDuration] = useState(CONTENT_MARKETPLACE_FILTER_ALL);
  const [page, setPage] = useState(1);
  const keyword = useDebounce(search.trim());
  const categoryQuery = toContentMarketplaceCategoryQuery(category);
  const durationQuery = findContentMarketplaceDuration(duration);
  const isBrowsingEverything = !keyword && !categoryQuery && !durationQuery;
  const catalog = useContentMarketplaceListings({
    keyword: keyword || undefined,
    category: categoryQuery,
    duration: durationQuery,
    sortBy: sort,
    page,
    perPage: CONTENT_MARKETPLACE_PAGE_SIZE,
  });
  const recentCatalog = useContentMarketplaceListings(
    CONTENT_MARKETPLACE_RECENT_QUERY,
    isBrowsingEverything,
  );
  const filterOptions = useContentMarketplaceFilterOptions();
  const listings = catalog.data?.data ?? [];
  const pagination = catalog.data?.pagination;
  const recentListings = recentCatalog.data?.data ?? [];
  const categories = filterOptions.data?.categories ?? [];

  return (
    <div className="flex flex-col gap-6">
      <header className="min-w-0">
        <h1 className="h4 break-words text-neutral-950">{t("contentMarketplace.title")}</h1>
        <p className="body-sm mt-1 max-w-2xl text-neutral-600">
          {t("contentMarketplace.discover")}
        </p>
      </header>

      <ContentMarketplaceFilters
        search={search}
        category={category}
        duration={duration}
        categories={categories}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        onCategoryChange={(value) => {
          setCategory(value);
          setPage(1);
        }}
        onDurationChange={(value) => {
          setDuration(value);
          setPage(1);
        }}
      />

      {isBrowsingEverything && recentListings.length > 0 && (
        <section aria-labelledby="marketplace-recent-title" className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <History className="mt-[7px] size-6 shrink-0 text-primary-700" aria-hidden />
            <div>
              <h2 id="marketplace-recent-title" className="h5">
                {t("contentMarketplace.recentTitle")}
              </h2>
              <p className="mt-0.5 text-sm text-neutral-600">
                {t("contentMarketplace.recentDescription")}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {recentListings.map((listing) => (
              <ContentMarketplaceSpotlight key={listing.id} listing={listing} />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="marketplace-all-title" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <LayoutGrid className="mt-[7px] size-6 shrink-0 text-primary-700" aria-hidden />
            <div>
              <h2 id="marketplace-all-title" className="h5">
                {t("contentMarketplace.allCourses")}
              </h2>
              <p className="mt-0.5 text-sm text-neutral-600" role="status" aria-live="polite">
                {t("contentMarketplace.results", { count: pagination?.totalItems ?? 0 })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="marketplace-sort" className="text-sm text-neutral-600">
              {t("contentMarketplace.sortBy")}
            </label>
            <Select
              value={sort}
              onValueChange={(value) => {
                const selectedSort = findContentMarketplaceSort(value);
                if (!selectedSort) return;
                setSort(selectedSort);
                setPage(1);
              }}
            >
              <SelectTrigger id="marketplace-sort" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CONTENT_MARKETPLACE_SORT.RECENT}>
                  {t("contentMarketplace.sortRecent")}
                </SelectItem>
                <SelectItem value={CONTENT_MARKETPLACE_SORT.TITLE}>
                  {t("contentMarketplace.sortTitle")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {catalog.isPending && <ContentMarketplaceLoading />}
        {catalog.isError && <ContentMarketplaceError onRetry={() => void catalog.refetch()} />}
        {!catalog.isPending && !catalog.isError && (
          <>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {listings.map((listing) => (
                <ContentMarketplaceListingCard key={listing.id} listing={listing} />
              ))}
            </div>
            {listings.length === 0 && (
              <ContentMarketplaceEmpty message={t("contentMarketplace.noResults")} />
            )}
            {pagination && pagination.totalItems > 0 && (
              <Pagination
                className="flex-wrap gap-3 px-0"
                totalItems={pagination.totalItems}
                itemsPerPage={CONTENT_MARKETPLACE_PAGE_SIZE}
                currentPage={pagination.page}
                canChangeItemsPerPage={false}
                onPageChange={setPage}
              />
            )}
            {pagination && listings.length === 0 && page > 1 && (
              <Button variant="outline" onClick={() => setPage(1)}>
                {t("contentMarketplace.firstPage")}
              </Button>
            )}
          </>
        )}
      </section>
    </div>
  );
}

export default function ContentMarketplacePage() {
  const { t } = useTranslation();
  return (
    <ContentMarketplaceGate>
      <PageWrapper
        breadcrumbs={[{ title: t("contentMarketplace.title"), href: CONTENT_MARKETPLACE_PATH }]}
      >
        <ContentMarketplaceListings />
      </PageWrapper>
    </ContentMarketplaceGate>
  );
}
