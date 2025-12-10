import { useNavigate } from "@remix-run/react";
import { ACCESS_GUARD, OnboardingPages } from "@repo/shared";
import { isEmpty } from "lodash-es";
import { useMemo, useReducer } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { useCategories, useCurrentUser } from "~/api/queries";
import { useAvailableCourses } from "~/api/queries/useAvailableCourses";
import { ButtonGroup } from "~/components/ButtonGroup/ButtonGroup";
import { Icon } from "~/components/Icon";
import { PageWrapper } from "~/components/PageWrapper";
import { ContentAccessGuard } from "~/Guards/AccessGuard";
import { useUserRole } from "~/hooks/useUserRole";
import Loader from "~/modules/common/Loader/Loader";
import {
  type FilterConfig,
  type FilterValue,
  SearchFilter,
} from "~/modules/common/SearchFilter/SearchFilter";
import { CourseList } from "~/modules/Courses/components/CourseList";
import { StudentsCurses } from "~/modules/Courses/components/StudentsCurses";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { DashboardIcon, HamburgerIcon } from "~/modules/icons/icons";
import { createSortOptions, type SortOption } from "~/types/sorting";
import { setPageTitle } from "~/utils/setPageTitle";

import { useTourSetup } from "../Onboarding/hooks/useTourSetup";
import { studentCoursesSteps } from "../Onboarding/routes/student";

import type { MetaFunction } from "@remix-run/react";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.courses");

const DEFAULT_STATE = { searchTitle: undefined, sort: "title", category: undefined };

export default function CoursesPage() {
  const { isStudent, isAdminLike } = useUserRole();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: currentUser } = useCurrentUser();

  type State = {
    searchTitle: string | undefined;
    sort: SortOption | undefined | "";
    category: string | undefined;
  };

  type Action =
    | { type: "SET_SEARCH_TITLE"; payload: string | undefined }
    | { type: "SET_SORT"; payload: string | undefined }
    | { type: "SET_CATEGORY"; payload: string | undefined };

  function reducer(state: State, action: Action): State {
    return match<Action, State>(action)
      .with({ type: "SET_SEARCH_TITLE" }, ({ payload }) => ({
        ...state,
        searchTitle: payload,
      }))
      .with({ type: "SET_SORT" }, ({ payload }) => ({
        ...state,
        sort: payload as SortOption,
      }))
      .with({ type: "SET_CATEGORY" }, ({ payload }) => ({
        ...state,
        category: payload === "all" ? undefined : payload,
      }))
      .exhaustive();
  }

  const [state, dispatch] = useReducer(reducer, DEFAULT_STATE as State);

  const { language } = useLanguageStore();

  const { data: userAvailableCourses, isLoading: isAvailableCoursesLoading } = useAvailableCourses({
    title: state.searchTitle,
    category: state.category,
    sort: state.sort,
    language,
  });

  const { data: categories, isLoading: isCategoriesLoading } = useCategories();

  const steps = useMemo(() => (isStudent ? studentCoursesSteps(t) : []), [t, isStudent]);

  useTourSetup({
    steps,
    isLoading: isAvailableCoursesLoading || isCategoriesLoading,
    hasCompletedTour: currentUser?.onboardingStatus.courses,
    page: OnboardingPages.COURSES,
  });

  const filterConfig: FilterConfig[] = [
    {
      name: "title",
      type: "text",
      placeholder: t("studentCoursesView.availableCourses.filters.placeholder.title"),
      default: DEFAULT_STATE.searchTitle,
    },
    {
      name: "category",
      type: "select",
      placeholder: t("studentCoursesView.availableCourses.filters.placeholder.categories"),
      options: categories?.map(({ title }) => ({
        value: title,
        label: title,
      })),
      default: DEFAULT_STATE.category,
    },
    {
      name: "sort",
      type: "select",
      placeholder: t("studentCoursesView.availableCourses.filters.placeholder.sort"),
      options: createSortOptions(t),
      default: DEFAULT_STATE.sort,
      hideAll: true,
    },
  ];

  const handleFilterChange = (name: string, value: FilterValue) => {
    switch (name) {
      case "title":
        dispatch({ type: "SET_SEARCH_TITLE", payload: value as string });
        break;
      case "category":
        dispatch({ type: "SET_CATEGORY", payload: value as string });
        break;
      case "sort":
        dispatch({ type: "SET_SORT", payload: value as string });
        break;
    }
  };

  return (
    <ContentAccessGuard type={ACCESS_GUARD.UNREGISTERED_COURSE_ACCESS}>
      <PageWrapper
        breadcrumbs={[
          {
            title: t("studentCoursesView.breadcrumbs.dashboard"),
            href: "/",
          },
          {
            title: t("studentCoursesView.breadcrumbs.courses"),
            href: "/courses",
          },
        ]}
      >
        <div className="flex h-auto flex-1 flex-col gap-y-12">
          {isStudent && <StudentsCurses />}
          <div className="flex flex-col">
            <div className="flex flex-col lg:p-0">
              <h4 className="pb-1 h4 text-neutral-950">
                {t("studentCoursesView.availableCourses.header")}
              </h4>
              <p className="body-lg-md text-neutral-800">
                {t("studentCoursesView.availableCourses.subHeader")}
              </p>
              <div className="flex items-center justify-between gap-2">
                <SearchFilter
                  id="course-filters"
                  filters={filterConfig}
                  values={{
                    title: state.searchTitle,
                    category: state.category,
                    sort: state.sort,
                  }}
                  onChange={handleFilterChange}
                  isLoading={isCategoriesLoading}
                />

                {isAdminLike && (
                  <ButtonGroup
                    buttons={[
                      {
                        children: <DashboardIcon />,
                        isActive: true,
                        onClick: () => navigate("/courses"),
                      },
                      {
                        children: <HamburgerIcon />,
                        isActive: false,
                        onClick: () => navigate("/admin/courses"),
                      },
                    ]}
                  />
                )}
              </div>
            </div>
            <div
              data-testid="unenrolled-courses"
              className="gap-6 rounded-lg drop-shadow-primary lg:bg-white lg:p-8 flex flex-wrap"
            >
              {userAvailableCourses && !isEmpty(userAvailableCourses) && (
                <CourseList availableCourses={userAvailableCourses} />
              )}
              {!userAvailableCourses ||
                (isEmpty(userAvailableCourses) && (
                  <div id="available-courses" className="col-span-3 flex gap-8">
                    <Icon name="EmptyCourse" className="mr-2 text-neutral-900" />
                    <div className="flex flex-col justify-center gap-2">
                      <p className="text-lg font-bold leading-5 text-neutral-950">
                        {t("studentCoursesView.other.cannotFindCourses")}
                      </p>
                      <p className="text-base font-normal leading-6 text-neutral-800">
                        {t("studentCoursesView.other.changeSearchCriteria")}
                      </p>
                    </div>
                  </div>
                ))}
              {isAvailableCoursesLoading && (
                <div className="flex h-full items-center justify-center">
                  <Loader />
                </div>
              )}
            </div>
          </div>
        </div>
      </PageWrapper>
    </ContentAccessGuard>
  );
}
