import { Link } from "@remix-run/react";
import { FORUM_SEARCH_MAX_LENGTH } from "@repo/shared";
import { ArrowLeft } from "lucide-react";
import { useDeferredValue, useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
  FORUM_COURSE_DISCUSSIONS_PER_PAGE,
  useForumCourseDiscussionsSuspense,
  type ForumCourseDiscussionsQuery,
} from "~/api/queries/forum/useForumCourseDiscussions";
import { useClampedPage } from "~/components/DataTable";
import { PageWrapper } from "~/components/PageWrapper";
import { Pagination } from "~/components/Pagination/Pagination";
import { SearchInput } from "~/components/SearchInput/SearchInput";
import { ForumFeatureGuard } from "~/Guards/ForumFeatureGuard";
import { useUrlTableState } from "~/hooks/useUrlTableState";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { FORUM_HANDLES } from "../../../e2e/data/forum/handles";

import { ForumCourseDiscussionListItem } from "./components/ForumCourseDiscussionListItem";
import { FORUM_COURSE_DISCUSSIONS_PATH } from "./forum.utils";

const NO_FILTER_KEYS = [] as const;

export default function ForumCourseDiscussionListPage() {
  return (
    <ForumFeatureGuard>
      <ForumCourseDiscussionList />
    </ForumFeatureGuard>
  );
}

function ForumCourseDiscussionList() {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const tableState = useUrlTableState({
    filterKeys: NO_FILTER_KEYS,
    defaultPerPage: FORUM_COURSE_DISCUSSIONS_PER_PAGE,
  });

  const courseDiscussionsQuery = useMemo<ForumCourseDiscussionsQuery>(
    () => ({
      page: tableState.page,
      perPage: FORUM_COURSE_DISCUSSIONS_PER_PAGE,
      search: tableState.search || undefined,
      language,
    }),
    [tableState.page, tableState.search, language],
  );

  const deferredCourseDiscussionsQuery = useDeferredValue(courseDiscussionsQuery);
  const { data: courseDiscussions } = useForumCourseDiscussionsSuspense(
    deferredCourseDiscussionsQuery,
  );
  const { totalItems } = courseDiscussions.pagination;

  useClampedPage({
    page: tableState.page,
    perPage: FORUM_COURSE_DISCUSSIONS_PER_PAGE,
    totalItems,
    setPage: tableState.setPage,
  });

  return (
    <PageWrapper
      breadcrumbs={[
        { title: t("forum.title"), href: "/forum" },
        { title: t("forum.courseDiscussions.title"), href: FORUM_COURSE_DISCUSSIONS_PATH },
      ]}
    >
      <section className="flex flex-col gap-6" data-testid={FORUM_HANDLES.COURSE_DISCUSSIONS_PAGE}>
        <div className="space-y-3">
          <Link
            to="/forum"
            className="body-sm-md inline-flex items-center gap-1 text-primary-700 hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t("forum.topic.backToForum")}
          </Link>
          <h1 className="h4 text-neutral-950">{t("forum.courseDiscussions.title")}</h1>
        </div>

        <SearchInput
          value={tableState.searchInput}
          onChange={(event) => tableState.setSearchInput(event.target.value)}
          placeholder={t("forum.courseDiscussions.searchPlaceholder")}
          maxLength={FORUM_SEARCH_MAX_LENGTH}
          wrapperClassName="min-w-[220px]"
          data-testid={FORUM_HANDLES.COURSE_DISCUSSIONS_SEARCH_INPUT}
        />

        {totalItems === 0 ? (
          <p
            className="body-sm text-neutral-600"
            data-testid={FORUM_HANDLES.COURSE_DISCUSSIONS_EMPTY_STATE}
          >
            {tableState.search
              ? t("forum.courseDiscussions.noResults")
              : t("forum.courseDiscussions.empty")}
          </p>
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
            {courseDiscussions.data.map((courseDiscussion) => (
              <li key={courseDiscussion.courseId}>
                <ForumCourseDiscussionListItem courseDiscussion={courseDiscussion} />
              </li>
            ))}
          </ul>
        )}

        {totalItems > FORUM_COURSE_DISCUSSIONS_PER_PAGE && (
          <Pagination
            totalItems={totalItems}
            itemsPerPage={FORUM_COURSE_DISCUSSIONS_PER_PAGE}
            currentPage={tableState.page}
            canChangeItemsPerPage={false}
            onPageChange={tableState.setPage}
          />
        )}
      </section>
    </PageWrapper>
  );
}
