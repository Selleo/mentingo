import { useSearchParams } from "@remix-run/react";
import { FORUM_SEARCH_MAX_LENGTH, FORUM_TOPIC_SORTS, type ForumTopicSort } from "@repo/shared";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { FORUM_TOPICS_PER_PAGE, useForumTopics } from "~/api/queries/forum/useForumTopics";
import { useCurrentUser } from "~/api/queries/useCurrentUser";
import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { useStudentCourses } from "~/api/queries/useStudentCourses";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
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
import { Skeleton } from "~/components/ui/skeleton";
import { useDebounce } from "~/hooks/useDebounce";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { FORUM_HANDLES } from "../../../e2e/data/forum/handles";

import { CreateForumTopicDialog } from "./components/CreateForumTopicDialog";
import { ForumTopicListItem } from "./components/ForumTopicListItem";
import {
  FORUM_FILTERS,
  canReadCourseThreads,
  parsePageParam,
  parseSortParam,
  toTopicFilterQuery,
} from "./forum.utils";

const SORT_LABEL_KEYS = {
  [FORUM_TOPIC_SORTS.LAST_ACTIVITY]: "forum.sort.lastActivity",
  [FORUM_TOPIC_SORTS.NEWEST]: "forum.sort.newest",
  [FORUM_TOPIC_SORTS.MOST_REPLIES]: "forum.sort.mostReplies",
} as const satisfies Record<ForumTopicSort, string>;

export default function ForumTopicsPage() {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const search = useDebounce(searchInput.trim());

  const { data: globalSettings, error: settingsError } = useGlobalSettings();
  const { data: currentUser } = useCurrentUser();
  const permissions = currentUser?.permissions ?? [];
  const isForumEnabled = globalSettings?.forumEnabled === true;
  const courseDiscussionsEnabled = globalSettings?.courseDiscussionsEnabled;
  const showCourseThreads = canReadCourseThreads(permissions, courseDiscussionsEnabled);

  const page = parsePageParam(searchParams.get("page"));
  const sort = parseSortParam(searchParams.get("sort"));
  const filter = searchParams.get("filter") ?? FORUM_FILTERS.ALL;

  const { data: courses = [] } = useStudentCourses(
    { language },
    { enabled: isForumEnabled && showCourseThreads },
  );
  const { data: topics, error: topicsError } = useForumTopics(
    {
      page,
      perPage: FORUM_TOPICS_PER_PAGE,
      sort,
      language,
      search: search || undefined,
      ...toTopicFilterQuery(filter),
    },
    { enabled: isForumEnabled },
  );

  const courseOptions = courses.map(({ id, title }) => ({ id, title }));
  const loadError = settingsError ?? topicsError;

  const updateSearchParams = (changes: Record<string, string | null>) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);

        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }

        return next;
      },
      { replace: true },
    );
  };

  const renderTopics = () => {
    if (loadError) {
      return (
        <p className="body-sm text-neutral-600" data-testid={FORUM_HANDLES.ERROR}>
          {getTranslatedApiErrorMessage(loadError, t, t("forum.loadError"))}
        </p>
      );
    }

    if (!globalSettings) return <Skeleton className="h-64 w-full" />;

    if (!isForumEnabled) {
      return (
        <p className="body-sm text-neutral-600" data-testid={FORUM_HANDLES.UNAVAILABLE}>
          {t("forum.unavailable")}
        </p>
      );
    }

    if (!topics) return <Skeleton className="h-64 w-full" />;

    if (!topics.data.length) {
      const isFiltered = Boolean(search) || filter !== FORUM_FILTERS.ALL;

      return (
        <p className="body-sm text-neutral-600" data-testid={FORUM_HANDLES.EMPTY_STATE}>
          {isFiltered ? t("forum.noResults") : t("forum.empty")}
        </p>
      );
    }

    return (
      <div className="flex flex-col gap-3">
        {topics.data.map((topic) => (
          <ForumTopicListItem key={topic.id} topic={topic} />
        ))}
      </div>
    );
  };

  return (
    <PageWrapper breadcrumbs={[{ title: t("forum.title"), href: "/forum" }]}>
      <section className="flex flex-col gap-6" data-testid={FORUM_HANDLES.PAGE}>
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="h4 text-neutral-950">{t("forum.title")}</h1>
            <p className="body-sm text-neutral-600">{t("forum.description")}</p>
          </div>
          {isForumEnabled && (
            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              data-testid={FORUM_HANDLES.NEW_TOPIC_BUTTON}
            >
              <Plus className="mr-2 size-4" aria-hidden />
              {t("forum.newTopic")}
            </Button>
          )}
        </header>

        {isForumEnabled && (
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value);
                updateSearchParams({ page: null });
              }}
              placeholder={t("forum.searchPlaceholder")}
              maxLength={FORUM_SEARCH_MAX_LENGTH}
              wrapperClassName="min-w-[220px]"
              data-testid={FORUM_HANDLES.SEARCH_INPUT}
            />
            <Select
              value={filter}
              onValueChange={(value) =>
                updateSearchParams({
                  filter: value === FORUM_FILTERS.ALL ? null : value,
                  page: null,
                })
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
                {courseOptions.map((course) => (
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
                updateSearchParams({
                  sort: value === FORUM_TOPIC_SORTS.LAST_ACTIVITY ? null : value,
                  page: null,
                })
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
        )}

        {renderTopics()}

        {topics && topics.pagination.totalItems > FORUM_TOPICS_PER_PAGE && (
          <Pagination
            totalItems={topics.pagination.totalItems}
            itemsPerPage={FORUM_TOPICS_PER_PAGE}
            currentPage={page}
            canChangeItemsPerPage={false}
            onPageChange={(nextPage) =>
              updateSearchParams({ page: nextPage > 1 ? String(nextPage) : null })
            }
          />
        )}
      </section>

      {isForumEnabled && (
        <CreateForumTopicDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} />
      )}
    </PageWrapper>
  );
}
