import { Link } from "@remix-run/react";
import { useQueries } from "@tanstack/react-query";
import { replace, toLower, upperFirst } from "lodash-es";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { usePopper } from "react-popper";

import {
  availableCoursesQueryOptions,
  categoriesQueryOptions,
  studentCoursesQueryOptions,
} from "../../api/queries";
import { useGroupsQuery } from "../../api/queries/admin/useGroups";
import { allCoursesQueryOptions } from "../../api/queries/useCourses";
import { usersQueryOptions } from "../../api/queries/useUsers";
import { GlobalSearchMac, GlobalSearchWin } from "../../assets/svgs";
import { SegmentedRing } from "../../assets/svgs/segmented-ring";
import { useDebounce } from "../../hooks/useDebounce";
import { useUserRole } from "../../hooks/useUserRole";
import { cn } from "../../lib/utils";
import { SearchInput } from "../SearchInput/SearchInput";

import type {
  GetAllCategoriesResponse,
  GetAllCoursesResponse,
  GetAllGroupsResponse,
  GetUsersResponse,
  GetStudentCoursesResponse,
  GetAvailableCoursesResponse,
} from "../../api/generated-api";
import type { SearchInputProps } from "../SearchInput/SearchInput";

const normalizeText = (value?: string | null): string => {
  if (!value) return "";
  const spaced = replace(value, /[_-]+/g, " ");
  return upperFirst(toLower(spaced));
};

type NavigationGlobalSearchProps = SearchInputProps & {
  containerClassName?: string;
  autoFocusOnMount?: boolean;
};

type GlobalSearchItem =
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
    };

export const NavigationGlobalSearch = forwardRef<HTMLDivElement, NavigationGlobalSearchProps>(
  ({ containerClassName, autoFocusOnMount, ...props }, ref) => {
    const [searchParams, setSearchParams] = useState("");
    const [isFocused, setIsFocused] = useState(false);
    const debouncedSearch = useDebounce(searchParams, 300);
    const { isAdmin, isContentCreator } = useUserRole();
    const isAdminOrContentCreator = isAdmin || isContentCreator;
    const searchContainerRef = useRef<HTMLDivElement | null>(null);
    const [referenceElement, setReferenceElement] = useState<HTMLElement | null>(null);
    const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null);

    const { styles, attributes } = usePopper(referenceElement, popperElement, {
      placement: "bottom-start",
      modifiers: [
        { name: "offset", options: { offset: [0, 8] } },
        { name: "flip", options: { fallbackPlacements: ["top-start", "bottom-start"] } },
        { name: "preventOverflow", options: { padding: 8 } },
      ],
    });

    const setContainerRef = useCallback(
      (node: HTMLDivElement | null) => {
        searchContainerRef.current = node;
        setReferenceElement(node);
        if (ref) {
          if (typeof ref === "function") {
            ref(node);
          } else {
            ref.current = node;
          }
        }
      },
      [ref],
    );

    const isMac =
      typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("mac");

    useEffect(() => {
      if (autoFocusOnMount) {
        const input = searchContainerRef.current?.querySelector("input") as HTMLInputElement | null;
        input?.focus();
      }
    }, [autoFocusOnMount]);

    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape" && isFocused) {
          const input = searchContainerRef.current?.querySelector(
            "input",
          ) as HTMLInputElement | null;
          input?.blur();
          setSearchParams("");
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isFocused]);

    return (
      <div className={cn("relative", containerClassName)} ref={setContainerRef}>
        <SearchInput
          {...props}
          clearable
          value={searchParams}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e as never);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e as never);
          }}
          rightAdornment={
            !isFocused && (searchParams?.length ?? 0) === 0 ? (
              isMac ? (
                <GlobalSearchMac className="absolute right-2 top-1/2 -translate-y-1/2 transform" />
              ) : (
                <GlobalSearchWin className="absolute right-2 top-1/2 -translate-y-1/2 transform" />
              )
            ) : null
          }
          onChange={(e) => {
            setSearchParams(e.target.value);
          }}
        />
        {debouncedSearch.length >= 3 && (
          <div
            ref={setPopperElement}
            style={styles.popper}
            {...attributes.popper}
            className="z-50 flex w-[480px] rounded-md border border-slate-100 bg-white p-[5px] shadow-md"
          >
            {isAdminOrContentCreator ? (
              <AdminResults
                debouncedSearch={debouncedSearch}
                onSelect={() => setSearchParams("")}
              />
            ) : (
              <StudentResults
                debouncedSearch={debouncedSearch}
                onSelect={() => setSearchParams("")}
              />
            )}
          </div>
        )}
      </div>
    );
  },
);

NavigationGlobalSearch.displayName = "NavigationGlobalSearch";

const AdminResults = ({
  debouncedSearch,
  onSelect,
}: {
  debouncedSearch: string;
  onSelect: () => void;
}) => {
  const { isAdmin, isContentCreator } = useUserRole();
  const isAllowed = isAdmin || isContentCreator;

  const tabsToDisplay = useQueries({
    queries: [
      allCoursesQueryOptions({ title: debouncedSearch }, { enabled: debouncedSearch.length >= 3 }),
      usersQueryOptions(
        { keyword: debouncedSearch },
        { enabled: isAllowed && debouncedSearch.length >= 3 },
      ),
      categoriesQueryOptions(
        { title: debouncedSearch },
        { enabled: isAllowed && debouncedSearch.length >= 3 },
      ),
      useGroupsQuery(
        { name: debouncedSearch },
        { enabled: isAllowed && debouncedSearch.length >= 3 },
      ),
    ],
    combine: (results) => {
      const [courses, users, categories, groups] = results as Array<{
        data?: unknown[];
        isFetching?: boolean;
      }>;

      const mapped: GlobalSearchItem[] = [
        {
          resultType: "allCourses",
          resultData:
            (courses?.data as GetAllCoursesResponse["data"] | undefined) ??
            ([] as GetAllCoursesResponse["data"]),
          Component: CourseEntry,
        },
        {
          resultType: "users",
          resultData:
            (users?.data as GetUsersResponse["data"] | undefined) ??
            ([] as GetUsersResponse["data"]),
          Component: UserEntry,
        },
        {
          resultType: "categories",
          resultData:
            (categories?.data as GetAllCategoriesResponse["data"] | undefined) ??
            ([] as GetAllCategoriesResponse["data"]),
          Component: CategoryEntry,
        },
        {
          resultType: "groups",
          resultData:
            (groups?.data as GetAllGroupsResponse["data"] | undefined) ??
            ([] as GetAllGroupsResponse["data"]),
          Component: GroupEntry,
        },
      ];

      const isFetching = (results as Array<{ isFetching?: boolean }>).some((r) =>
        Boolean(r?.isFetching),
      );

      return { items: mapped, isFetching };
    },
  });

  return (
    <Content tabsToDisplay={tabsToDisplay} debouncedSearch={debouncedSearch} onSelect={onSelect} />
  );
};

const StudentResults = ({
  debouncedSearch,
  onSelect,
}: {
  debouncedSearch: string;
  onSelect: () => void;
}) => {
  const tabsToDisplay = useQueries({
    queries: [
      studentCoursesQueryOptions(
        { title: debouncedSearch },
        { enabled: debouncedSearch.length >= 3 },
      ),
      availableCoursesQueryOptions(
        { title: debouncedSearch },
        { enabled: debouncedSearch.length >= 3 },
      ),
    ],
    combine: (results) => {
      const [studentCourses, availableCourses] = results as Array<{
        data?: unknown[];
        isFetching?: boolean;
      }>;

      const mapped: GlobalSearchItem[] = [
        {
          resultType: "myCourses",
          resultData:
            (studentCourses?.data as GetStudentCoursesResponse["data"] | undefined) ??
            ([] as GetStudentCoursesResponse["data"]),
          Component: CourseEntryMyCourses,
        },
        {
          resultType: "availableCourses",
          resultData:
            (availableCourses?.data as GetAvailableCoursesResponse["data"] | undefined) ??
            ([] as GetAvailableCoursesResponse["data"]),
          Component: CourseEntry,
        },
      ];

      const isFetching = (results as Array<{ isFetching?: boolean }>).some((r) =>
        Boolean(r?.isFetching),
      );

      return { items: mapped, isFetching };
    },
  });

  return (
    <Content tabsToDisplay={tabsToDisplay} debouncedSearch={debouncedSearch} onSelect={onSelect} />
  );
};

const Content = ({
  tabsToDisplay,
  debouncedSearch,
  onSelect,
}: {
  tabsToDisplay: { isFetching: boolean; items: GlobalSearchItem[] };
  debouncedSearch: string;
  onSelect: () => void;
}) => {
  const { t } = useTranslation();
  return (
    <>
      {!tabsToDisplay.isFetching ? (
        <div className="flex w-full flex-col gap-3">
          {(() => {
            const sectionsWithItems = tabsToDisplay.items.filter(
              (section) => Array.isArray(section.resultData) && section.resultData.length > 0,
            );
            if (sectionsWithItems.length === 0) {
              return (
                <div className="py-4 text-center text-sm text-neutral-500">
                  {`${t("globalSearch.noSearchResults")} ${debouncedSearch}`}
                </div>
              );
            }
            return sectionsWithItems.map((section) => {
              const sectionId = `global-search-${section.resultType}`;
              return (
                <div key={section.resultType} className="w-full">
                  <h3 id={sectionId} className="details-md px-[8px] py-[2px] text-neutral-600">
                    {t(`globalSearch.${section.resultType}`)}
                  </h3>
                  <ul aria-labelledby={sectionId} className="space-y-1">
                    {section.resultData.map((item, index) => (
                      <section.Component
                        key={`${section.resultType}-${index}`}
                        item={item as never}
                        onSelect={onSelect}
                      />
                    ))}
                  </ul>
                </div>
              );
            });
          })()}
        </div>
      ) : (
        <div className="py-4 text-center text-sm text-neutral-500">Searching…</div>
      )}
    </>
  );
};

const CourseEntry = ({
  item,
  onSelect,
}: {
  item: GetAllCoursesResponse["data"][number];
  onSelect: () => void;
}) => {
  const { isStudent } = useUserRole();

  return (
    <Link
      to={isStudent ? `/course/${item.id}` : `/admin/beta-courses/${item.id}`}
      onClick={onSelect}
    >
      <li className="flex items-center gap-3 rounded-md px-[8px] py-[6px] text-sm text-neutral-900 hover:bg-primary-50">
        <img
          src={item?.thumbnailUrl ?? ""}
          alt={item.title}
          className="size-4 rounded-sm bg-[#D9D9D9]"
        />
        <span className="line-clamp-1 flex-1">{item.title}</span>
        <span className="text-md ps-3 text-neutral-600">{item.category}</span>
      </li>
    </Link>
  );
};

const CourseEntryMyCourses = ({
  item,
  onSelect,
}: {
  item: GetStudentCoursesResponse["data"][number];
  onSelect: () => void;
}) => {
  const { isStudent } = useUserRole();

  return (
    <Link
      to={isStudent ? `/course/${item.id}` : `/admin/beta-courses/${item.id}`}
      onClick={onSelect}
    >
      <li className="flex items-center gap-3 rounded-md px-[8px] py-[6px] text-sm text-neutral-900 hover:bg-primary-50">
        <img
          src={item?.thumbnailUrl ?? ""}
          alt={item.title}
          className="size-4 rounded-sm bg-[#D9D9D9]"
        />
        <span className="line-clamp-1 flex-1">{item.title}</span>
        <span className="flex items-center gap-2 ps-3 text-neutral-600">
          <SegmentedRing
            segments={item.courseChapterCount}
            completed={item.completedChapterCount}
            size={16}
          />
          <span className="text-md text-neutral-950">{`${item.completedChapterCount}/${item.courseChapterCount}`}</span>
        </span>
      </li>
    </Link>
  );
};
const UserEntry = ({
  item,
  onSelect,
}: {
  item: GetUsersResponse["data"][number];
  onSelect: () => void;
}) => {
  return (
    <Link to={`/admin/users/${item.id}`} onClick={onSelect}>
      <li className="flex items-center gap-3 rounded-md px-[8px] py-[6px] text-sm text-neutral-900 hover:bg-primary-50">
        <img
          src={item?.profilePictureUrl ?? ""}
          alt={item.firstName}
          className="size-4 rounded-full bg-[#D9D9D9]"
        />
        <span className="line-clamp-1 flex-1">
          {item.firstName} {item.lastName}
        </span>
        <span className="text-md ps-3 text-neutral-600">{normalizeText(item.role)}</span>
      </li>
    </Link>
  );
};
const CategoryEntry = ({
  item,
  onSelect,
}: {
  item: GetAllCategoriesResponse["data"][number];
  onSelect: () => void;
}) => {
  return (
    <Link to={`/admin/categories/${item.id}`} onClick={onSelect}>
      <li className="flex items-center gap-3 rounded-md px-[8px] py-[6px] text-sm text-neutral-900 hover:bg-primary-50">
        <span className="line-clamp-1">{item.title}</span>
      </li>
    </Link>
  );
};
const GroupEntry = ({
  item,
  onSelect,
}: {
  item: GetAllGroupsResponse["data"][number];
  onSelect: () => void;
}) => {
  return (
    <Link to={`/admin/groups/${item.id}`} onClick={onSelect}>
      <li className="rounded-md px-[8px] py-[6px] text-sm text-neutral-800 hover:bg-primary-50">
        <span className="line-clamp-1">{item.name}</span>
      </li>
    </Link>
  );
};
