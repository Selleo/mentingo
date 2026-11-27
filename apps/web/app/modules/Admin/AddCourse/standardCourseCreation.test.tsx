import { fireEvent, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import AddCourse from "./AddCourse";
import CourseTypeSelector from "./CourseTypeSelector.page";

const { permissions, lumaConfig } = vi.hoisted(() => ({
  permissions: vi.fn(),
  lumaConfig: vi.fn(),
}));

vi.mock("~/hooks/usePermissions", () => ({ usePermissions: permissions }));
vi.mock("~/api/queries/useLumaConfigured", () => ({ useLumaConfigured: lumaConfig }));
vi.mock("~/api/queries/useCategories", () => ({
  useCategoriesSuspense: () => ({ data: [] }),
}));
vi.mock("~/api/mutations/admin/useUploadFile", () => ({
  useUploadFile: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("~/api/mutations/useCreateCourse", () => ({
  useCreateCourse: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("./components/CourseMetadataFields", () => ({
  CourseMetadataFields: () => null,
}));
vi.mock("./components/CourseThumbnailUploadField", () => ({
  CourseThumbnailUploadField: () => null,
}));

const renderCreation = (path: string) =>
  renderWith().render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/beta-courses/new" element={<CourseTypeSelector />} />
        <Route path="/admin/beta-courses/new/standard" element={<AddCourse />}>
          <Route path="ai" element={<p>AI draft composer</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

describe("Standard course creation", () => {
  it("offers AI creation after choosing Standard and preserves the catalogue context", () => {
    permissions.mockReturnValue({ hasAccess: true });
    lumaConfig.mockReturnValue({ data: { courseGenerationEnabled: true } });

    renderCreation("/admin/beta-courses/new?categoryId=category-a&from=courses");

    expect(screen.queryByRole("link", { name: /create with ai/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: /standard/i }));

    const aiAction = screen.getByRole("link", { name: "Create with AI" });
    expect(aiAction).toHaveAccessibleDescription(
      "Describe your course and review the draft before creating it.",
    );
    expect(aiAction).toHaveAttribute(
      "href",
      "/admin/beta-courses/new/standard/ai?categoryId=category-a&from=courses",
    );
    expect(screen.getByTestId("create-course-submit-button")).toBeInTheDocument();
  });

  it.each([
    [false, true],
    [true, false],
  ])("hides the AI action when access is %s and generation is %s", (hasAccess, enabled) => {
    permissions.mockReturnValue({ hasAccess });
    lumaConfig.mockReturnValue({ data: { courseGenerationEnabled: enabled } });

    renderCreation("/admin/beta-courses/new/standard");

    expect(screen.queryByRole("link", { name: "Create with AI" })).not.toBeInTheDocument();
    expect(screen.getByTestId("create-course-submit-button")).toBeInTheDocument();
  });

  it("closes the drawer onto the Standard form and keeps the draft link available", async () => {
    permissions.mockReturnValue({ hasAccess: true });
    lumaConfig.mockReturnValue({ data: { courseGenerationEnabled: true } });

    const draftSearch = "?categoryId=category-a&from=courses&draftId=draft-a&sessionId=session-a";
    renderCreation(`/admin/beta-courses/new/standard/ai${draftSearch}`);

    const drawer = await screen.findByRole("dialog", { name: "Create with AI" });
    expect(drawer).toHaveTextContent("AI draft composer");
    expect(screen.getByRole("button", { name: "Resize panel" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Expand" }));
    expect(screen.getByRole("button", { name: "Collapse" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /close/i }));

    expect(screen.queryByRole("dialog", { name: "Create with AI" })).not.toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Create with AI" })).toHaveAttribute(
      "href",
      `/admin/beta-courses/new/standard/ai${draftSearch}`,
    );
    expect(screen.getByTestId("create-course-submit-button")).toBeInTheDocument();
  });
});
