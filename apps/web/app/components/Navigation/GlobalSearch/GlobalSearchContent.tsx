import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { NoData } from "~/assets/svgs";
import { cn } from "~/lib/utils";
import Loader from "~/modules/common/Loader/Loader";

import type {
  GetAllCategoriesResponse,
  GetAllCoursesResponse,
  GetAllGroupsResponse,
  GetAnnouncementsForUserResponse,
  GetAvailableCoursesResponse,
  GetStudentCoursesResponse,
  GetUsersResponse,
} from "~/api/generated-api";

export type GlobalSearchItem =
  | {
      resultType: "allCourses";
      resultData: GetAllCoursesResponse["data"];
      Component: (props: {
        item: GetAllCoursesResponse["data"][number];
        onSelect: () => void;
      }) => JSX.Element;
    }
  | {
      resultType: "myCourses";
      resultData: GetStudentCoursesResponse["data"];
      Component: (props: {
        item: GetStudentCoursesResponse["data"][number];
        onSelect: () => void;
      }) => JSX.Element;
    }
  | {
      resultType: "availableCourses";
      resultData: GetAvailableCoursesResponse["data"];
      Component: (props: {
        item: GetAvailableCoursesResponse["data"][number];
        onSelect: () => void;
      }) => JSX.Element;
    }
  | {
      resultType: "users";
      resultData: GetUsersResponse["data"];
      Component: (props: {
        item: GetUsersResponse["data"][number];
        onSelect: () => void;
      }) => JSX.Element;
    }
  | {
      resultType: "categories";
      resultData: GetAllCategoriesResponse["data"];
      Component: (props: {
        item: GetAllCategoriesResponse["data"][number];
        onSelect: () => void;
      }) => JSX.Element;
    }
  | {
      resultType: "groups";
      resultData: GetAllGroupsResponse["data"];
      Component: (props: {
        item: GetAllGroupsResponse["data"][number];
        onSelect: () => void;
      }) => JSX.Element;
    }
  | {
      resultType: "announcements";
      resultData: GetAnnouncementsForUserResponse["data"];
      Component: (props: {
        item: GetAnnouncementsForUserResponse["data"][number];
        onSelect: () => void;
      }) => JSX.Element;
    };

export const GlobalSearchContent = ({
  tabsToDisplay,
  onSelect,
  activeIndex,
  setTotalItems,
}: {
  tabsToDisplay: { isFetching: boolean; items: GlobalSearchItem[] };
  onSelect: () => void;
  activeIndex: number;
  setTotalItems: (count: number) => void;
}) => {
  const { t } = useTranslation();

  useEffect(() => {
    const sectionsWithItems = tabsToDisplay.items.filter(
      (section) => Array.isArray(section.resultData) && section.resultData.length > 0,
    );
    const totalCount = sectionsWithItems.reduce(
      (acc, section) => acc + section.resultData.length,
      0,
    );
    setTotalItems(totalCount);
  }, [tabsToDisplay.items, setTotalItems]);

  useEffect(() => {
    const activeElement = document.querySelector(`[data-search-index="${activeIndex}"]`);
    if (activeElement) {
      activeElement.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [activeIndex]);

  return (
    <>
      {!tabsToDisplay.isFetching ? (
        <div className="flex max-h-[400px] w-full flex-col gap-3 overflow-y-auto">
          {(() => {
            const sectionsWithItems = tabsToDisplay.items.filter(
              (section) => Array.isArray(section.resultData) && section.resultData.length > 0,
            );
            if (sectionsWithItems.length === 0) {
              return (
                <div className="flex flex-col px-6 py-[50px]">
                  <NoData className="mx-auto" />
                  <span className="pt-4 text-center text-sm font-semibold text-neutral-950">
                    Niestety nic nie znaleziono
                  </span>
                  <span className="text-normal-800 text-center text-[12px] font-normal leading-[160%]">
                    Spróbuj ponownie użyć innych słów kluczowych
                  </span>
                </div>
              );
            }
            let globalIndex = 0;
            return sectionsWithItems.map((section) => {
              const sectionId = `global-search-${section.resultType}`;
              return (
                <div key={section.resultType} className="w-full">
                  <h3 id={sectionId} className="details-md px-[8px] py-[2px] text-neutral-600">
                    {t(`globalSearch.${section.resultType}`)}
                  </h3>
                  <ul aria-labelledby={sectionId} className="space-y-1">
                    {section.resultData.map((item, index) => {
                      const currentIndex = globalIndex++;
                      const isActive = currentIndex === activeIndex;
                      return (
                        <li
                          key={`${section.resultType}-${index}`}
                          data-search-index={currentIndex}
                          className={cn(isActive && "rounded-lg bg-primary-100")}
                        >
                          <section.Component item={item as never} onSelect={onSelect} />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            });
          })()}
        </div>
      ) : (
        <div className="mx-auto px-6 pt-4">
          <Loader />
        </div>
      )}
    </>
  );
};
