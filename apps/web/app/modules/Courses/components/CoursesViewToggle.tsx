import { Link, useNavigate } from "@remix-run/react";
import { useTranslation } from "react-i18next";

import { categoriesQueryOptions } from "~/api/queries/useCategories";
import { allCoursesQueryOptions } from "~/api/queries/useCourses";
import { queryClient } from "~/api/queryClient";
import { ButtonGroup } from "~/components/ButtonGroup/ButtonGroup";
import {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { DashboardIcon, HamburgerIcon } from "~/modules/icons/icons";

import { COURSES_VIEW_TOGGLE_HANDLES } from "../../../../e2e/data/courses/handles";
import { COURSES_VIEW_TOGGLE_MORPH_NAME } from "../utils/coursesMorph";

type CoursesView = "catalogue" | "manage";

type CoursesViewToggleProps = {
  active: CoursesView;
  className?: string;
};

const VIEW_PATHS: Record<CoursesView, string> = {
  catalogue: "/courses",
  manage: "/admin/courses",
};

const MORPH_STYLE = { viewTransitionName: COURSES_VIEW_TOGGLE_MORPH_NAME };

/**
 * Switches between the catalogue and the course management table. Navigation runs as a view
 * transition, so course titles morph between catalogue cards and table rows.
 */
export function CoursesViewToggle({ active, className }: CoursesViewToggleProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const language = useLanguageStore((state) => state.language);

  // The morph snapshots the table once navigation commits, so its data must already be cached.
  const prefetchManageView = () => {
    void queryClient.prefetchQuery(allCoursesQueryOptions({ isArchived: false, language }));
    void queryClient.prefetchQuery(categoriesQueryOptions({ language }));
  };

  if (active === "catalogue") {
    const label = t("adminCoursesView.courses.header");

    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to={VIEW_PATHS.manage}
              viewTransition
              onMouseEnter={prefetchManageView}
              onFocus={prefetchManageView}
              aria-label={label}
              style={MORPH_STYLE}
              className={cn(
                "flex size-11 items-center justify-center rounded-full bg-white text-neutral-900 shadow-lg ring-1 ring-black/5 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 [&_svg]:size-5",
                className,
              )}
              data-testid={COURSES_VIEW_TOGGLE_HANDLES.TOGGLE}
            >
              <HamburgerIcon />
            </Link>
          </TooltipTrigger>
          <TooltipContent
            side="left"
            className="rounded bg-black px-2 py-1 text-sm text-white shadow-md"
          >
            {label}
            <TooltipArrow className="fill-black" />
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className={className} style={MORPH_STYLE} data-testid={COURSES_VIEW_TOGGLE_HANDLES.TOGGLE}>
      <ButtonGroup
        buttons={[
          {
            children: <DashboardIcon />,
            isActive: false,
            onClick: () => navigate(VIEW_PATHS.catalogue, { viewTransition: true }),
            "aria-label": t("navigationSideBar.courses"),
          },
          {
            children: <HamburgerIcon />,
            isActive: true,
            "aria-label": t("adminCoursesView.courses.header"),
          },
        ]}
      />
    </div>
  );
}
