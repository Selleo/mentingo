import { isEmpty } from "lodash-es";
import { useReducer } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import {
  availableCoursesQueryOptions,
  currentUserQueryOptions,
  studentCoursesQueryOptions,
  useCategoriesSuspense,
} from "~/api/queries";
import { useAvailableCourses } from "~/api/queries/useAvailableCourses";
import { categoriesQueryOptions } from "~/api/queries/useCategories";
import { allCoursesQueryOptions } from "~/api/queries/useCourses";
import { queryClient } from "~/api/queryClient";
import { ButtonGroup } from "~/components/ButtonGroup/ButtonGroup";
import { Icon } from "~/components/Icon";
import { PageWrapper } from "~/components/PageWrapper";
import { USER_ROLE } from "~/config/userRoles";
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
import { SORT_OPTIONS, type SortOption } from "~/types/sorting";

import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [{ title: "Courses" }, { name: "description", content: "Courses" }];
};

const prefetchQueriesForUser = async (userRole: string | undefined) => {
  await queryClient.prefetchQuery(categoriesQueryOptions());

  return match(userRole)
    .with(USER_ROLE.admin, USER_ROLE.contentCreator, async () => {
      await queryClient.prefetchQuery(allCoursesQueryOptions());
    })
    .with(USER_ROLE.student, async () => {
      await queryClient.prefetchQuery(availableCoursesQueryOptions());
      await queryClient.prefetchQuery(studentCoursesQueryOptions());
    })
    .otherwise(async () => {
      await queryClient.prefetchQuery(availableCoursesQueryOptions());
    });
};

export const clientLoader = async () => {
  const currentUser = await queryClient.ensureQueryData(currentUserQueryOptions);
  const userRole = currentUser?.data.role;

  await prefetchQueriesForUser(userRole);

  return null;
};

export default function CoursesPage() {
  const { isStudent } = useUserRole();

  type State = {
    searchTitle: string | undefined;
    sort: SortOption | undefined | "";
    category: string | undefined;
  };

  type Action =
    | { type: "SET_SEARCH_TITLE"; payload: string | undefined }
    | { type: "SET_SORT"; payload: string | undefined }
    | { type: "SET_CATEGORY"; payload: string | undefined };

  const { t } = useTranslation();
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

  const [state, dispatch] = useReducer(reducer, {
    searchTitle: undefined,
    sort: undefined,
    category: undefined,
  });

  const { data: userAvailableCourses, isLoading: isAvailableCoursesLoading } = useAvailableCourses({
    title: state.searchTitle,
    category: state.category,
    sort: state.sort,
  });

  const { data: categories, isLoading: isCategoriesLoading } = useCategoriesSuspense();

  const { courseListLayout, setCourseListLayout } = useLayoutsStore();

  const filterConfig: FilterConfig[] = [
    {
      name: "title",
      type: "text",
      placeholder: t("studentCoursesView.availableCourses.filters.placeholder.title"),
    },
    {
      name: "category",
      type: "select",
      placeholder: t("studentCoursesView.availableCourses.filters.placeholder.categories"),
      options: categories?.map(({ title }) => ({
        value: title,
        label: title,
      })),
    },
    {
      name: "sort",
      type: "select",
      placeholder: t("studentCoursesView.availableCourses.filters.placeholder.sort"),
      options: SORT_OPTIONS,
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
    <PageWrapper>
      <div className="flex h-auto flex-1 flex-col gap-y-12">
        {isStudent && <StudentsCurses />}
        <div className="flex flex-col">
          <div className="flex flex-col lg:p-0">
            <h4 className="pb-1 text-2xl font-bold leading-10 text-neutral-950">
              {t("studentCoursesView.availableCourses.header")}
            </h4>
            <p className="text-lg leading-7 text-neutral-800">
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
                  <div>
                    <Icon name="EmptyCourse" className="mr-2 text-neutral-900" />
                  </div>
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
  );
}
