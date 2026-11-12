import { Link } from "@remix-run/react";
import { LayoutGrid, List } from "lucide-react";
import { useTranslation } from "react-i18next";

import { categoriesQueryOptions } from "~/api/queries/useCategories";
import { coursesTableQueryOptions } from "~/api/queries/useCoursesTable";
import { queryClient } from "~/api/queryClient";
import { cn } from "~/lib/utils";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { COURSES_VIEW_TOGGLE_HANDLES } from "../../../../e2e/data/courses/handles";
import { COURSES_TABLE_DEFAULT_PARAMS } from "../CoursesTable/coursesTable.constants";
import { loadCoursesTableView } from "../CoursesTable/loadCoursesTableView";
import { COURSES_VIEW_TOGGLE_MORPH_NAME } from "../utils/coursesMorph";
import {
  COURSES_CATALOGUE_PATH,
  COURSES_TABLE_PATH,
  COURSES_VIEWS,
  type CoursesView,
} from "../utils/coursesView";

import type { LucideIcon } from "lucide-react";

/** Pins the toggle to the same corner in both views, so only the page content swaps. */
export const COURSES_VIEW_TOGGLE_CORNER_CLASS_NAME =
  "absolute right-4 top-4 z-30 md:right-8 md:top-8";

type CoursesViewToggleProps = {
  active: CoursesView;
  className?: string;
};

type CoursesViewOption = {
  view: CoursesView;
  path: string;
  label: string;
  Icon: LucideIcon;
  onIntent?: () => void;
};

const MORPH_STYLE = { viewTransitionName: COURSES_VIEW_TOGGLE_MORPH_NAME };

/**
 * Switches the courses page between catalogue and table through the `view` URL param. The switch
 * runs as a view transition: the toggle stays put while the page content cross-fades.
 */
export function CoursesViewToggle({ active, className }: CoursesViewToggleProps) {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);

  // The transition snapshots the table once navigation commits, so its code and data must be ready.
  const prefetchTableView = () => {
    void loadCoursesTableView();
    void queryClient.prefetchQuery(
      coursesTableQueryOptions({ ...COURSES_TABLE_DEFAULT_PARAMS, language }),
    );
    void queryClient.prefetchQuery(categoriesQueryOptions({ language }));
  };

  const viewOptions: CoursesViewOption[] = [
    {
      view: COURSES_VIEWS.CATALOGUE,
      path: COURSES_CATALOGUE_PATH,
      label: t("coursesViewToggle.catalogue"),
      Icon: LayoutGrid,
    },
    {
      view: COURSES_VIEWS.TABLE,
      path: COURSES_TABLE_PATH,
      label: t("coursesViewToggle.table"),
      Icon: List,
      onIntent: prefetchTableView,
    },
  ];

  return (
    <nav
      aria-label={t("coursesViewToggle.label")}
      style={MORPH_STYLE}
      data-testid={COURSES_VIEW_TOGGLE_HANDLES.TOGGLE}
      className={cn(
        "inline-flex h-10 items-center gap-1 rounded-lg border border-neutral-200 bg-white p-1 shadow-sm",
        className,
      )}
    >
      {viewOptions.map(({ view, path, label, Icon, onIntent }) => {
        const isActive = view === active;
        const optionClassName = cn(
          "flex h-full items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors [&_svg]:size-4",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
          isActive && "bg-primary-50 text-primary-800",
          !isActive && "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-950",
        );
        const optionContent = (
          <>
            <Icon aria-hidden />
            <span className="sr-only sm:not-sr-only">{label}</span>
          </>
        );

        if (isActive) {
          return (
            <span
              key={view}
              aria-current="page"
              className={optionClassName}
              data-testid={COURSES_VIEW_TOGGLE_HANDLES.option(view)}
            >
              {optionContent}
            </span>
          );
        }

        return (
          <Link
            key={view}
            to={path}
            viewTransition
            onMouseEnter={onIntent}
            onFocus={onIntent}
            onTouchStart={onIntent}
            className={optionClassName}
            data-testid={COURSES_VIEW_TOGGLE_HANDLES.option(view)}
          >
            {optionContent}
          </Link>
        );
      })}
    </nav>
  );
}
