import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { NoData } from "~/assets/svgs";
import { cn } from "~/lib/utils";
import Loader from "~/modules/common/Loader/Loader";

import type { SearchResponse } from "~/api/generated-api";

type GlobalSearchData = SearchResponse["data"];

export type GlobalSearchItem =
  | {
      resultType: "allCourses";
      resultData: GlobalSearchData["allCourses"];
      Component: (props: {
        item: GlobalSearchData["allCourses"][number];
        onSelect: () => void;
      }) => JSX.Element;
    }
  | {
      resultType: "myCourses";
      resultData: GlobalSearchData["myCourses"];
      Component: (props: {
        item: GlobalSearchData["myCourses"][number];
        onSelect: () => void;
      }) => JSX.Element;
    }
  | {
      resultType: "availableCourses";
      resultData: GlobalSearchData["availableCourses"];
      Component: (props: {
        item: GlobalSearchData["availableCourses"][number];
        onSelect: () => void;
      }) => JSX.Element;
    }
  | {
      resultType: "learningPaths";
      resultData: GlobalSearchData["learningPaths"];
      Component: (props: {
        item: GlobalSearchData["learningPaths"][number];
        onSelect: () => void;
      }) => JSX.Element;
    }
  | {
      resultType: "users";
      resultData: GlobalSearchData["users"];
      Component: (props: {
        item: GlobalSearchData["users"][number];
        onSelect: () => void;
      }) => JSX.Element;
    }
  | {
      resultType: "categories";
      resultData: GlobalSearchData["categories"];
      Component: (props: {
        item: GlobalSearchData["categories"][number];
        onSelect: () => void;
      }) => JSX.Element;
    }
  | {
      resultType: "groups";
      resultData: GlobalSearchData["groups"];
      Component: (props: {
        item: GlobalSearchData["groups"][number];
        onSelect: () => void;
      }) => JSX.Element;
    }
  | {
      resultType: "lessons";
      resultData: GlobalSearchData["lessons"];
      Component: (props: {
        item: GlobalSearchData["lessons"][number];
        onSelect: () => void;
      }) => JSX.Element;
    }
  | {
      resultType: "news";
      resultData: GlobalSearchData["news"];
      Component: (props: {
        item: GlobalSearchData["news"][number];
        onSelect: () => void;
      }) => JSX.Element;
    }
  | {
      resultType: "articles";
      resultData: GlobalSearchData["articles"];
      Component: (props: {
        item: GlobalSearchData["articles"][number];
        onSelect: () => void;
      }) => JSX.Element;
    }
  | {
      resultType: "qa";
      resultData: GlobalSearchData["qa"];
      Component: (props: {
        item: GlobalSearchData["qa"][number];
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

  // Keep the first course destination while sharing one ranked list and keyboard order.
  const results = useMemo(() => {
    const seenCourses = new Set<string>();
    return tabsToDisplay.items
      .flatMap((section) =>
        section.resultData.flatMap((item) => {
          const isCourse = ["allCourses", "myCourses", "availableCourses"].includes(
            section.resultType,
          );
          if (isCourse && seenCourses.has(item.id)) return [];
          if (isCourse) seenCourses.add(item.id);
          const isAdministrative = ["users", "groups", "categories"].includes(section.resultType);
          const score =
            "relevanceScore" in item && typeof item.relevanceScore === "number"
              ? item.relevanceScore
              : undefined;
          return [{ section, item, score, isAdministrative }];
        }),
      )
      .sort((left, right) => {
        if (left.isAdministrative !== right.isAdministrative) return left.isAdministrative ? 1 : -1;
        if (left.isAdministrative) return 0;
        if (left.score === undefined && right.score === undefined) return 0;
        if (left.score === undefined) return 1;
        if (right.score === undefined) return -1;
        return right.score - left.score;
      });
  }, [tabsToDisplay.items]);

  useEffect(() => {
    setTotalItems(tabsToDisplay.isFetching ? 0 : results.length);
  }, [results, tabsToDisplay.isFetching, setTotalItems]);

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
          {results.length === 0 ? (
            <div className="flex flex-col px-6 py-[50px]">
              <NoData className="mx-auto" />
              <span className="pt-4 text-center body-sm-md text-neutral-950">
                {t("globalSearch.notFound")}
              </span>
              <span className="text-center details text-neutral-800">
                {t("globalSearch.tryAgain")}
              </span>
            </div>
          ) : (
            <ul className="space-y-1" aria-label={t("globalSearch.search")}>
              {results.map(({ section, item, isAdministrative }, index) => (
                <li
                  key={`${section.resultType}-${item.id}`}
                  data-search-index={index}
                  className={cn("rounded-lg py-1", index === activeIndex && "bg-primary-100")}
                >
                  {isAdministrative && !results[index - 1]?.isAdministrative && (
                    <h3 className="border-t border-neutral-200 px-2 pt-3 pb-1 text-sm text-neutral-600">
                      {t("globalSearch.administrativeResults")}
                    </h3>
                  )}
                  <span className="px-2 text-xs text-neutral-600">
                    {t(`globalSearch.entries.${section.resultType}`)}
                  </span>
                  <section.Component item={item as never} onSelect={onSelect} />
                  {!isAdministrative &&
                    "matchedAttachmentFileName" in item &&
                    item.matchedAttachmentFileName && (
                      <span className="block line-clamp-1 px-2 text-xs text-neutral-600">
                        {item.matchedAttachmentFileName}
                      </span>
                    )}
                  {!isAdministrative && "matchedPassage" in item && item.matchedPassage && (
                    <p className="line-clamp-2 px-2 text-xs text-neutral-600">
                      {item.matchedPassage}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div role="status" aria-label={t("globalSearch.loading")} className="mx-auto px-6 pt-4">
          <Loader />
        </div>
      )}
    </>
  );
};
