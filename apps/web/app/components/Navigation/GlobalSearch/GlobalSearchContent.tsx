import { GLOBAL_SEARCH_RESULT_TYPES } from "@repo/shared";
import { SearchX } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";

import { ArticleEntry } from "./ArticleEntry";
import { CategoryEntry } from "./CategoryEntry";
import { CourseEntry } from "./CourseEntry";
import { GlobalSearchMoreRow } from "./GlobalSearchMoreRow";
import { titleExplainsMatch } from "./globalSearchQuery";
import { GroupEntry } from "./GroupEntry";
import { LearningPathEntry } from "./LearningPathEntry";
import { LessonEntry } from "./LessonEntry";
import { NewsEntry } from "./NewsEntry";
import { QAEntry } from "./QAEntry";
import { UserEntry } from "./UserEntry";

import type {
  GlobalSearchAdministrativeResults,
  GlobalSearchContentNode,
  GlobalSearchResultNode,
} from "./globalSearchNodes";
import type { ReactNode } from "react";

const SKELETON_TITLE_WIDTHS = ["w-[48%]", "w-[36%]", "w-[56%]"] as const;
const SKELETON_META_WIDTHS = ["w-[16%]", "w-[22%]", "w-[12%]"] as const;

const CONTENT_ENTRIES = {
  [GLOBAL_SEARCH_RESULT_TYPES.NEWS]: NewsEntry,
  [GLOBAL_SEARCH_RESULT_TYPES.ARTICLE]: ArticleEntry,
  [GLOBAL_SEARCH_RESULT_TYPES.QA]: QAEntry,
} satisfies Record<GlobalSearchContentNode["type"], unknown>;

/** One keyboard-selectable line; depth 1 rows are drawn under their course. */
type SearchRow = {
  key: string;
  depth: 0 | 1;
  render: (isActive: boolean) => ReactNode;
};

type SearchSection = {
  key: string;
  heading?: ReactNode;
  /** Accessible list name when the heading is not plain text or is hidden. */
  label?: string;
  rows: SearchRow[];
};

type Evidence = { title: string; matchedAttachmentFileName?: string | null };

export const GlobalSearchContent = ({
  isFetching,
  results,
  administrative,
  onSelect,
  activeIndex,
  setTotalItems,
  query = "",
  isAiRanked = false,
  emptyAction,
}: {
  isFetching: boolean;
  results: GlobalSearchResultNode[];
  administrative: GlobalSearchAdministrativeResults;
  onSelect: () => void;
  activeIndex: number;
  setTotalItems: (count: number) => void;
  query?: string;
  isAiRanked?: boolean;
  emptyAction?: { label: string; onClick: () => void };
}) => {
  const { t } = useTranslation();

  // The API already ranks and groups learning content; this only flattens the tree into rows
  // whose order matches keyboard navigation. Administrative matches follow in their own section.
  const sections = useMemo((): SearchSection[] => {
    // An excerpt earns its line only when it explains the hit: a file match, or a title
    // that does not already contain the query.
    const showPassage = (item: Evidence) =>
      !!item.matchedAttachmentFileName || !titleExplainsMatch(item.title, query);
    const entryProps = (item: Evidence, type: string) => ({
      onSelect,
      typeLabel: t(`globalSearch.types.${type}`),
      showPassage: showPassage(item),
    });

    const content = results.flatMap((node): SearchRow[] => {
      switch (node.type) {
        case GLOBAL_SEARCH_RESULT_TYPES.COURSE:
          return [
            {
              key: `course-${node.id}`,
              depth: 0,
              render: (isActive) => (
                <CourseEntry item={node} isActive={isActive} {...entryProps(node, node.type)} />
              ),
            },
            ...node.lessons.map(
              (lesson): SearchRow => ({
                key: `lesson-${lesson.id}`,
                depth: 1,
                render: (isActive) => (
                  <LessonEntry
                    item={lesson}
                    isActive={isActive}
                    {...entryProps(lesson, lesson.type)}
                  />
                ),
              }),
            ),
            ...(node.hiddenLessonCount > 0
              ? [
                  {
                    key: `more-${node.id}`,
                    depth: 1 as const,
                    render: () => (
                      <GlobalSearchMoreRow
                        to={`/course/${node.id}`}
                        label={t("globalSearch.moreInCourse", { count: node.hiddenLessonCount })}
                        onSelect={onSelect}
                      />
                    ),
                  },
                ]
              : []),
          ];
        case GLOBAL_SEARCH_RESULT_TYPES.LEARNING_PATH:
          return [
            {
              key: `learningPath-${node.id}`,
              depth: 0,
              render: (isActive) => (
                <LearningPathEntry
                  item={node}
                  isActive={isActive}
                  {...entryProps(node, node.type)}
                />
              ),
            },
          ];
        default: {
          const Entry = CONTENT_ENTRIES[node.type];
          return [
            {
              key: `${node.type}-${node.id}`,
              depth: 0,
              render: (isActive) => (
                <Entry item={node} isActive={isActive} {...entryProps(node, node.type)} />
              ),
            },
          ];
        }
      }
    });

    // Administrative matches are keyword-only and grouped by kind under their own headings;
    // the heading names the kind, so these rows carry no type label.
    const adminProps = { onSelect, showPassage: false };
    const administrativeSections: SearchSection[] = [
      {
        key: "users",
        heading: t("globalSearch.entries.users"),
        rows: administrative.users.map(
          (user): SearchRow => ({
            key: `user-${user.id}`,
            depth: 0,
            render: (isActive) => <UserEntry item={user} isActive={isActive} {...adminProps} />,
          }),
        ),
      },
      {
        key: "groups",
        heading: t("globalSearch.entries.groups"),
        rows: administrative.groups.map(
          (group): SearchRow => ({
            key: `group-${group.id}`,
            depth: 0,
            render: (isActive) => <GroupEntry item={group} isActive={isActive} {...adminProps} />,
          }),
        ),
      },
      {
        key: "categories",
        heading: t("globalSearch.entries.categories"),
        rows: administrative.categories.map(
          (category): SearchRow => ({
            key: `category-${category.id}`,
            depth: 0,
            render: (isActive) => (
              <CategoryEntry item={category} isActive={isActive} {...adminProps} />
            ),
          }),
        ),
      },
    ].filter((section) => section.rows.length > 0);

    // Learning content is only labelled when other sections follow it.
    const contentHeading =
      administrativeSections.length > 0 ? t("globalSearch.contentResults") : undefined;

    return [
      {
        key: "content",
        heading: contentHeading,
        label: t("globalSearch.contentResults"),
        rows: content,
      },
      ...administrativeSections,
    ].filter((section) => section.rows.length > 0);
  }, [administrative, onSelect, query, results, t]);
  const totalRows = sections.reduce((count, section) => count + section.rows.length, 0);

  useEffect(() => {
    setTotalItems(isFetching ? 0 : totalRows);
  }, [totalRows, isFetching, setTotalItems]);

  useEffect(() => {
    const activeElement = document.querySelector(`[data-search-index="${activeIndex}"]`);
    if (activeElement) {
      activeElement.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [activeIndex]);

  if (isFetching) {
    return (
      <div role="status" aria-label={t("globalSearch.loading")} className="flex flex-col gap-1">
        {SKELETON_TITLE_WIDTHS.map((titleWidth, index) => (
          <div key={titleWidth} className="flex items-center gap-2.5 px-2.5 py-2">
            <Skeleton className="size-5 shrink-0 rounded" />
            <Skeleton className={cn("h-3.5 rounded-full", titleWidth)} />
            <Skeleton className={cn("ml-auto h-3 rounded-full", SKELETON_META_WIDTHS[index])} />
          </div>
        ))}
      </div>
    );
  }

  if (totalRows === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
        <span className="mb-1 flex size-11 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
          <SearchX className="size-5" aria-hidden />
        </span>
        <span className="body-sm-md text-neutral-950">{t("globalSearch.notFound")}</span>
        <span className="max-w-[340px] details text-neutral-600">
          {isAiRanked ? t("globalSearch.aiTryAgain") : t("globalSearch.tryAgain")}
        </span>
        {emptyAction && (
          <button
            type="button"
            onClick={emptyAction.onClick}
            className="mt-2 inline-flex min-h-10 items-center rounded-lg border border-neutral-200 bg-white px-4 body-sm-md text-neutral-950 hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
          >
            {emptyAction.label}
          </button>
        )}
      </div>
    );
  }

  const renderRows = (rows: SearchRow[], firstIndex: number) =>
    rows.map(({ key, depth, render }, offset) => {
      const index = firstIndex + offset;
      const isActive = index === activeIndex;
      return (
        <li
          key={key}
          data-search-index={index}
          // Children hang off a guide line aligned with the course icon.
          className={cn(depth === 1 && "ml-5 border-l border-neutral-200 pl-1.5")}
        >
          <div className={cn("rounded-md", isActive && "bg-primary-50")}>{render(isActive)}</div>
        </li>
      );
    });

  let firstIndex = 0;

  return (
    <div className="flex max-h-[min(520px,65vh)] w-full flex-col overflow-y-auto">
      {sections.map((section, sectionIndex) => {
        const sectionFirstIndex = firstIndex;
        firstIndex += section.rows.length;
        return (
          <section
            key={section.key}
            className={cn(sectionIndex > 0 && "mt-2 border-t border-neutral-100 pt-2")}
          >
            {section.heading && (
              <h3 className="flex items-center gap-1.5 px-2.5 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
                {section.heading}
              </h3>
            )}
            <ul
              className="flex flex-col"
              aria-label={
                section.label ?? (typeof section.heading === "string" ? section.heading : undefined)
              }
            >
              {renderRows(section.rows, sectionFirstIndex)}
            </ul>
          </section>
        );
      })}
    </div>
  );
};
