import {
  FORUM_SEARCH_MAX_LENGTH,
  FORUM_TOPIC_SORTS,
  PERMISSIONS,
  type ForumTopicSort,
} from "@repo/shared";
import { Plus } from "lucide-react";
import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  FORUM_TOPICS_PER_PAGE,
  useForumTopicsSuspense,
  type ForumTopicsQuery,
} from "~/api/queries/forum/useForumTopics";
import { useCurrentUser } from "~/api/queries/useCurrentUser";
import { hasPermission } from "~/common/permissions/permission.utils";
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
import { useToast } from "~/components/ui/use-toast";
import { ForumFeatureGuard } from "~/Guards/ForumFeatureGuard";
import { useUrlTableState } from "~/hooks/useUrlTableState";

import { FORUM_HANDLES } from "../../../e2e/data/forum/handles";

import { CreateForumTopicDialog } from "./components/CreateForumTopicDialog";
import { ForumCourseDiscussions } from "./components/ForumCourseDiscussions";
import { ForumTopicListItem } from "./components/ForumTopicListItem";
import { FORUM_SORT_URL_PARAM, parseSortParam } from "./forum.utils";
import { useForumSocket } from "./useForumSocket";

const SORT_LABEL_KEYS = {
  [FORUM_TOPIC_SORTS.LAST_ACTIVITY]: "forum.sort.lastActivity",
  [FORUM_TOPIC_SORTS.NEWEST]: "forum.sort.newest",
  [FORUM_TOPIC_SORTS.MOST_REPLIES]: "forum.sort.mostReplies",
} as const satisfies Record<ForumTopicSort, string>;

const FORUM_TOPICS_FILTER_KEYS = [FORUM_SORT_URL_PARAM] as const;

export default function ForumTopicsPage() {
  return (
    <ForumFeatureGuard>
      <ForumTopics />
    </ForumFeatureGuard>
  );
}

function ForumTopics() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { data: currentUser } = useCurrentUser();

  const handleMentioned = useCallback(() => {
    toast({ description: t("forum.toast.mentioned") });
  }, [t, toast]);

  useForumSocket({ onMentioned: handleMentioned });

  const canCreateTopic = hasPermission(
    currentUser?.permissions ?? [],
    PERMISSIONS.FORUM_TOPIC_CREATE,
  );

  const tableState = useUrlTableState({
    filterKeys: FORUM_TOPICS_FILTER_KEYS,
    defaultPerPage: FORUM_TOPICS_PER_PAGE,
  });
  const sort = parseSortParam(tableState.filters[FORUM_SORT_URL_PARAM]);

  const topicsQuery = useMemo<ForumTopicsQuery>(
    () => ({
      page: tableState.page,
      perPage: FORUM_TOPICS_PER_PAGE,
      sort,
      search: tableState.search || undefined,
    }),
    [tableState.page, tableState.search, sort],
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

  return (
    <PageWrapper breadcrumbs={[{ title: t("forum.title"), href: "/forum" }]}>
      <section className="flex flex-col gap-6" data-testid={FORUM_HANDLES.PAGE}>
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="h4 text-neutral-950">{t("forum.title")}</h1>
            <p className="body-sm text-neutral-600">{t("forum.description")}</p>
          </div>
          {canCreateTopic && (
            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              data-testid={FORUM_HANDLES.NEW_TOPIC_BUTTON}
            >
              <Plus className="mr-2 size-4" aria-hidden />
              {t("forum.newTopic")}
            </Button>
          )}
        </header>

        <ForumCourseDiscussions />

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
            value={sort}
            onValueChange={(value) =>
              tableState.setFilter(
                FORUM_SORT_URL_PARAM,
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
            {tableState.search ? t("forum.noResults") : t("forum.empty")}
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

      {canCreateTopic && (
        <CreateForumTopicDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} />
      )}
    </PageWrapper>
  );
}
