import { FORUM_SEARCH_MAX_LENGTH, FORUM_TOPIC_SORTS, type ForumTopicSort } from "@repo/shared";
import { Plus } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  FORUM_TOPICS_PER_PAGE,
  useForumTopicsSuspense,
  type ForumTopicsQuery,
} from "~/api/queries/forum/useForumTopics";
import { useCurrentUser } from "~/api/queries/useCurrentUser";
import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { useStudentCoursesSuspense } from "~/api/queries/useStudentCourses";
import { useClampedPage } from "~/components/DataTable";
import { PageWrapper } from "~/components/PageWrapper";
import { Pagination } from "~/components/Pagination/Pagination";
import { SearchInput } from "~/components/SearchInput/SearchInput";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { ForumFeatureGuard } from "~/Guards/ForumFeatureGuard";
import { useUrlTableState } from "~/hooks/useUrlTableState";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { FORUM_HANDLES } from "../../../e2e/data/forum/handles";

import { CreateForumTopicDialog } from "./components/CreateForumTopicDialog";
import { ForumTopicListItem } from "./components/ForumTopicListItem";
import {
  FORUM_FILTERS,
  FORUM_URL_PARAMS,
  canReadCourseThreads,
  isForumTopicFilter,
  parseSortParam,
  toTopicFilterQuery,
} from "./forum.utils";

const SORT_LABEL_KEYS = {
  [FORUM_TOPIC_SORTS.LAST_ACTIVITY]: "forum.sort.lastActivity",
  [FORUM_TOPIC_SORTS.NEWEST]: "forum.sort.newest",
  [FORUM_TOPIC_SORTS.MOST_REPLIES]: "forum.sort.mostReplies",
} as const satisfies Record<ForumTopicSort, string>;

const FORUM_TOPICS_FILTER_KEYS = [FORUM_URL_PARAMS.FILTER, FORUM_URL_PARAMS.SORT] as const;

type ForumCourse = { id: string; title: string };

const NO_COURSES: ForumCourse[] = [];

export default function ForumTopicsPage() {
  return (
    <ForumFeatureGuard>
      <ForumTopicsByCourseAccess />
    </ForumFeatureGuard>
  );
}

function ForumTopicsByCourseAccess() {
  const { data: globalSettings } = useGlobalSettings();
  const { data: currentUser } = useCurrentUser();
  const showCourseThreads = canReadCourseThreads(
    currentUser?.permissions ?? [],
    globalSettings?.courseDiscussionsEnabled,
  );

  return showCourseThreads ? <ForumTopicsWithCourses /> : <ForumTopics courses={NO_COURSES} />;
}

function ForumTopicsWithCourses() {
  const language = useLanguageStore((state) => state.language);
  const { data: courses } = useStudentCoursesSuspense({ language });

  return <ForumTopics courses={courses} />;
}

type ForumTopicsProps = {
  courses: ForumCourse[];
};

function ForumTopics({ courses }: ForumTopicsProps) {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const tableState = useUrlTableState({
    filterKeys: FORUM_TOPICS_FILTER_KEYS,
    filterValidators: {
      [FORUM_URL_PARAMS.FILTER]: (value) =>
        isForumTopicFilter(
          value,
          courses.map((course) => course.id),
        ),
    },
    defaultPerPage: FORUM_TOPICS_PER_PAGE,
  });
  const filter = tableState.filters[FORUM_URL_PARAMS.FILTER] ?? FORUM_FILTERS.ALL;
  const sort = parseSortParam(tableState.filters[FORUM_URL_PARAMS.SORT]);

  const topicsQuery = useMemo<ForumTopicsQuery>(
    () => ({
      page: tableState.page,
      perPage: FORUM_TOPICS_PER_PAGE,
      sort,
      language,
      search: tableState.search || undefined,
      ...toTopicFilterQuery(filter),
    }),
    [tableState.page, tableState.search, sort, language, filter],
  );

  const deferredTopicsQuery = useDeferredValue(topicsQuery);
  const { data: topics } = useForumTopicsSuspense(deferredTopicsQuery);
  const { totalItems } = topics.pagination;

  useClampedPage({
    page: tableState.page,
    perPage: FORUM_TOPICS_PER_PAGE,
    totalItems,
    setPage: tableState.setPage,
  });

  const isFiltered = Boolean(tableState.search) || filter !== FORUM_FILTERS.ALL;

  return (
    <PageWrapper breadcrumbs={[{ title: t("forum.title"), href: "/forum" }]}>
      <section className="flex flex-col gap-6" data-testid={FORUM_HANDLES.PAGE}>
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="h4 text-neutral-950">{t("forum.title")}</h1>
            <p className="body-sm text-neutral-600">{t("forum.description")}</p>
          </div>
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            data-testid={FORUM_HANDLES.NEW_TOPIC_BUTTON}
          >
            <Plus className="mr-2 size-4" aria-hidden />
            {t("forum.newTopic")}
          </Button>
        </header>

        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={tableState.searchInput}
            onChange={(event) => tableState.setSearchInput(event.target.value)}
            placeholder={t("forum.searchPlaceholder")}
            maxLength={FORUM_SEARCH_MAX_LENGTH}
            wrapperClassName="min-w-[220px]"
            data-testid={FORUM_HANDLES.SEARCH_INPUT}
          />
          <Select
            value={filter}
            onValueChange={(value) =>
              tableState.setFilter(
                FORUM_URL_PARAMS.FILTER,
                value === FORUM_FILTERS.ALL ? undefined : value,
              )
            }
          >
            <SelectTrigger
              className="w-full sm:w-60"
              aria-label={t("forum.filter.label")}
              data-testid={FORUM_HANDLES.FILTER_SELECT}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                value={FORUM_FILTERS.ALL}
                data-testid={FORUM_HANDLES.filterOption(FORUM_FILTERS.ALL)}
              >
                {t("forum.filter.all")}
              </SelectItem>
              <SelectItem
                value={FORUM_FILTERS.GENERAL}
                data-testid={FORUM_HANDLES.filterOption(FORUM_FILTERS.GENERAL)}
              >
                {t("forum.filter.general")}
              </SelectItem>
              {courses.map((course) => (
                <SelectItem
                  key={course.id}
                  value={course.id}
                  data-testid={FORUM_HANDLES.filterOption(course.id)}
                >
                  {course.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={sort}
            onValueChange={(value) =>
              tableState.setFilter(
                FORUM_URL_PARAMS.SORT,
                value === FORUM_TOPIC_SORTS.LAST_ACTIVITY ? undefined : value,
              )
            }
          >
            <SelectTrigger
              className="w-full sm:w-48"
              aria-label={t("forum.sort.label")}
              data-testid={FORUM_HANDLES.SORT_SELECT}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(FORUM_TOPIC_SORTS).map((sortOption) => (
                <SelectItem
                  key={sortOption}
                  value={sortOption}
                  data-testid={FORUM_HANDLES.sortOption(sortOption)}
                >
                  {t(SORT_LABEL_KEYS[sortOption])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {totalItems === 0 ? (
          <p className="body-sm text-neutral-600" data-testid={FORUM_HANDLES.EMPTY_STATE}>
            {isFiltered ? t("forum.noResults") : t("forum.empty")}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {topics.data.map((topic) => (
              <ForumTopicListItem key={topic.id} topic={topic} />
            ))}
          </div>
        )}

        {totalItems > FORUM_TOPICS_PER_PAGE && (
          <Pagination
            totalItems={totalItems}
            itemsPerPage={FORUM_TOPICS_PER_PAGE}
            currentPage={tableState.page}
            canChangeItemsPerPage={false}
            onPageChange={tableState.setPage}
          />
        )}
      </section>

      <CreateForumTopicDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} />
    </PageWrapper>
  );
}
