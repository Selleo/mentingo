import { fireEvent, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { renderWith } from "~/utils/testUtils";

import { AdminLearningPathsHeader } from "./AdminLearningPathsHeader";

const { pageContext } = vi.hoisted(() => ({
  pageContext: {
    totalPaths: 0,
    canCreateLearningPaths: true,
    canImportLearningPaths: true,
    openCreateCard: vi.fn(),
  },
}));

vi.mock("../context/AdminLearningPathsPageContext", () => ({
  useAdminLearningPathsPageContext: () => pageContext,
}));

vi.mock("~/modules/Admin/AddCourse/components/NativeArchiveImport", () => ({
  NativeArchiveImport: ({
    onCancel,
    onComplete,
  }: {
    onCancel: () => void;
    onComplete: () => void;
  }) => (
    <div>
      <button type="button" onClick={onCancel}>
        Cancel import
      </button>
      <button type="button" onClick={onComplete}>
        Complete import
      </button>
    </div>
  ),
}));

describe("AdminLearningPathsHeader", () => {
  afterEach(() => {
    pageContext.canImportLearningPaths = true;
  });

  it("opens package import in a dialog and closes it on Cancel or completion", () => {
    renderWith().render(
      <MemoryRouter>
        <AdminLearningPathsHeader />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /import development path/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel import" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /import development path/i }));
    fireEvent.click(screen.getByRole("button", { name: "Complete import" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("hides package import without the required permissions", () => {
    pageContext.canImportLearningPaths = false;

    renderWith().render(
      <MemoryRouter>
        <AdminLearningPathsHeader />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("button", { name: /import development path/i }),
    ).not.toBeInTheDocument();
  });
});
