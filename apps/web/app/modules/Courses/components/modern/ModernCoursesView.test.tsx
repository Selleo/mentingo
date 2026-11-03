import { PERMISSIONS } from "@repo/shared";
import { render, screen } from "@testing-library/react";

import ModernCoursesView from "./ModernCoursesView";

import type { ReactNode } from "react";

const state = vi.hoisted(() => ({
  canManageCategories: true,
  isCategoriesLoading: false,
}));

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ isLoading: false }) }));
vi.mock("~/api/queries", () => ({
  useCurrentUser: () => ({ data: { id: "user" } }),
  courseQueryOptions: () => ({}),
  useInfiniteAvailableCourses: () => ({
    data: { pages: [{ data: [{ id: "course", title: "Course", slug: "course" }] }] },
    isLoading: false,
    hasNextPage: false,
  }),
  useInfiniteStudentCourses: () => ({ data: { pages: [{ data: [] }] }, isLoading: false }),
  useInfiniteAvailableCourseCategories: () => ({
    data: { pages: [{ data: [{ id: "category", title: "Category" }] }] },
    isLoading: state.isCategoriesLoading,
    hasNextPage: false,
  }),
}));
vi.mock("~/api/queries/useGlobalSettings", () => ({ useGlobalSettings: () => ({ data: {} }) }));
vi.mock("~/api/queries/useTopCourses", () => ({
  useTopCourses: () => ({ data: [], isLoading: false }),
}));
vi.mock("~/hooks/usePermissions", () => ({
  usePermissions: ({ required }: { required: string | string[] }) => ({
    hasAccess: required === PERMISSIONS.CATEGORY_MANAGE && state.canManageCategories,
  }),
}));
vi.mock("~/modules/Dashboard/Settings/Language/LanguageStore", () => ({
  useLanguageStore: () => ({ language: "pl" }),
}));
vi.mock("~/components/PageWrapper", () => ({
  PageWrapper: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock("~/modules/ContentMarketplace/components/ContentMarketplaceCoursesRow", () => ({
  ContentMarketplaceCoursesRow: () => <section aria-label="Course catalog" />,
}));
vi.mock("~/modules/Courses/components/CoursesViewToggle", () => ({
  CoursesViewToggle: () => null,
}));
vi.mock("./admin/AddCategoryRow", () => ({
  AddCategoryRow: () => <button type="button">+ Dodaj kategorię</button>,
}));
vi.mock("./admin/AddCourseToCategoryButton", () => ({ AddCourseToCategoryButton: () => null }));
vi.mock("./admin/FeaturedCourseDialog", () => ({ FeaturedCourseDialog: () => null }));
vi.mock("./HeroBanner", () => ({ default: () => <section aria-label="Featured course" /> }));
vi.mock("./HeroBannerSkeleton", () => ({ default: () => <div>Loading featured course</div> }));
vi.mock("./ModernCourseCarousel", () => ({
  default: ({ title }: { title: string }) => <section aria-label={title} />,
}));
vi.mock("./ModernCourseRowSkeleton", () => ({ default: () => <div>Loading courses</div> }));
vi.mock("./TopCoursesCarousel", () => ({ default: () => null }));

describe("ModernCoursesView catalog placement", () => {
  beforeEach(() => {
    state.canManageCategories = true;
    state.isCategoriesLoading = false;
  });

  it("renders the catalog after the add-category control for category managers", () => {
    render(<ModernCoursesView />);

    const category = screen.getByRole("region", { name: "Category" });
    const addCategory = screen.getByRole("button", { name: "+ Dodaj kategorię" });
    const catalog = screen.getByRole("region", { name: "Course catalog" });

    expect(
      category.compareDocumentPosition(addCategory) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      addCategory.compareDocumentPosition(catalog) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("keeps the catalog available without category-management permission", () => {
    state.canManageCategories = false;

    render(<ModernCoursesView />);

    expect(screen.getByRole("region", { name: "Course catalog" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Dodaj kategorię" })).not.toBeInTheDocument();
  });

  it.each([true, false])(
    "waits for categories before showing the catalog (category manager: %s)",
    (canManageCategories) => {
      state.canManageCategories = canManageCategories;
      state.isCategoriesLoading = true;

      const { rerender } = render(<ModernCoursesView />);

      // The hero is ready: this exercises the category guard, not the full-page loader.
      expect(screen.getByRole("region", { name: "Featured course" })).toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "Course catalog" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "+ Dodaj kategorię" })).not.toBeInTheDocument();
      expect(screen.getAllByText("Loading courses")).toHaveLength(4);

      state.isCategoriesLoading = false;
      rerender(<ModernCoursesView />);

      expect(screen.getByRole("region", { name: "Course catalog" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "+ Dodaj kategorię" }) !== null).toBe(
        canManageCategories,
      );
    },
  );
});
