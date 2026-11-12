import { OnboardingPages, PERMISSIONS } from "@repo/shared";
import { isEmpty } from "lodash-es";
import { useMemo, useReducer } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { useCategories, useCurrentUser } from "~/api/queries";
import { useAvailableCourses } from "~/api/queries/useAvailableCourses";
import { Icon } from "~/components/Icon";
import { PageWrapper } from "~/components/PageWrapper";
import { COURSES_TABLE_PERMISSIONS } from "~/config/routeAccessConfig";
import { usePermissions } from "~/hooks/usePermissions";
import Loader from "~/modules/common/Loader/Loader";
import {
  type FilterConfig,
  type FilterValue,
  SearchFilter,
} from "~/modules/common/SearchFilter/SearchFilter";
import { CourseList } from "~/modules/Courses/components/CourseList";
import { CoursesViewToggle } from "~/modules/Courses/components/CoursesViewToggle";
import { StudentsCurses } from "~/modules/Courses/components/StudentsCurses";
import { COURSES_VIEWS } from "~/modules/Courses/utils/coursesView";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { createSortOptions, type SortOption } from "~/types/sorting";

import { useTourSetup } from "../Onboarding/hooks/useTourSetup";
import { studentCoursesSteps } from "../Onboarding/routes/student";

const DEFAULT_STATE = { searchTitle: undefined, sort: "title", category: undefined };

const LegacyCoursesView = () => {
  const { hasAccess: canUpdateLearningProgress } = usePermissions({
    required: PERMISSIONS.LEARNING_PROGRESS_UPDATE,
  });
  const { hasAccess: canOpenCoursesTable } = usePermissions({
    required: COURSES_TABLE_PERMISSIONS,
  });
  const { t } = useTranslation();

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
    userId: currentUser?.id,
  });

  const { data: categories, isLoading: isCategoriesLoading } = useCategories({ language });

  const steps = useMemo(
    () => (canUpdateLearningProgress ? studentCoursesSteps(t) : []),
    [t, canUpdateLearningProgress],
  );

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
    <PageWrapper
      breadcrumbs={[
        {
          title: t("studentCoursesView.breadcrumbs.courses"),
          href: "/courses",
        },
      ]}
    >
      <div className="flex h-auto flex-1 flex-col gap-y-12">
        {canUpdateLearningProgress && <StudentsCurses />}
        <div className="flex flex-col">
          <div className="flex flex-col lg:p-0">
            <h4 className="h4 pb-1 text-neutral-950">
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

              {canOpenCoursesTable && <CoursesViewToggle active={COURSES_VIEWS.CATALOGUE} />}
            </div>
          </div>
          <div
            data-testid="unenrolled-courses"
            className="flex flex-wrap gap-6 rounded-lg drop-shadow-primary lg:bg-white lg:p-8"
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
  );
};

export default LegacyCoursesView;
