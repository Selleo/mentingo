import { isEmpty } from "lodash-es";
import { useReducer } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { useCategories } from "~/api/queries";
import { useAvailableCourses } from "~/api/queries/useAvailableCourses";
import { ButtonGroup } from "~/components/ButtonGroup/ButtonGroup";
import { Icon } from "~/components/Icon";
import { PageWrapper } from "~/components/PageWrapper";
import { useUserRole } from "~/hooks/useUserRole";
import { cn } from "~/lib/utils";
import { useLayoutsStore } from "~/modules/common/Layout/LayoutsStore";
import Loader from "~/modules/common/Loader/Loader";
import {
  type FilterConfig,
  type FilterValue,
  SearchFilter,
} from "~/modules/common/SearchFilter/SearchFilter";
import { CourseList } from "~/modules/Courses/components/CourseList";
import { StudentsCurses } from "~/modules/Courses/components/StudentsCurses";
import { DashboardIcon, HamburgerIcon } from "~/modules/icons/icons";
import { createSortOptions, type SortOption } from "~/types/sorting";

import { CoursesAccessGuard } from "./Courses.layout";

const DEFAULT_STATE = { searchTitle: undefined, sort: "title", category: undefined };

export default function CoursesPage() {
  const { isStudent } = useUserRole();
  const { t } = useTranslation();

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

  const { data: userAvailableCourses, isLoading: isAvailableCoursesLoading } = useAvailableCourses({
    title: state.searchTitle,
    category: state.category,
    sort: state.sort,
  });

  const { data: categories, isLoading: isCategoriesLoading } = useCategories();

  const { courseListLayout, setCourseListLayout } = useLayoutsStore();

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
    <CoursesAccessGuard>
      <PageWrapper
        breadcrumbs={[
          {
            title: t("studentCoursesView.breadcrumbs.dashboard"),
            href: "/",
          },
          {
            title: t("studentCoursesView.breadcrumbs.availableCourses"),
            href: "/admin/courses",
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
                  filters={filterConfig}
                  values={{
                    title: state.searchTitle,
                    category: state.category,
                    sort: state.sort,
                  }}
                  onChange={handleFilterChange}
                  isLoading={isCategoriesLoading}
                />
                <ButtonGroup
                  className="sr-only lg:not-sr-only"
                  buttons={[
                    {
                      children: <DashboardIcon />,
                      isActive: courseListLayout === "card",
                      onClick: () => setCourseListLayout("card"),
                    },
                    {
                      children: <HamburgerIcon />,
                      isActive: courseListLayout === "table",
                      onClick: () => setCourseListLayout("table"),
                    },
                  ]}
                />
              </div>
            </div>
            <div
              data-testid="unenrolled-courses"
              className={cn("gap-6 rounded-lg drop-shadow-primary lg:bg-white lg:p-8", {
                "flex flex-wrap": courseListLayout === "card",
                block: courseListLayout === "table",
              })}
            >
              {userAvailableCourses && !isEmpty(userAvailableCourses) && (
                <CourseList
                  availableCourses={userAvailableCourses}
                  courseListLayout={courseListLayout}
                />
              )}
              {!userAvailableCourses ||
                (isEmpty(userAvailableCourses) && (
                  <div className="col-span-3 flex gap-8">
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
    </CoursesAccessGuard>
  );
}
