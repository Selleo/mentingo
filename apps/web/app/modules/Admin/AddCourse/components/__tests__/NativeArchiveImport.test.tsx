import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

import i18next from "~/utils/mocks/i18next.mock";
import { renderWith } from "~/utils/testUtils";

import { NativeArchiveImport } from "../NativeArchiveImport";

const { submitImport, navigate, importStatus, importMutation } = vi.hoisted(() => ({
  submitImport: vi.fn(),
  navigate: vi.fn(),
  importStatus: { data: null as unknown },
  importMutation: { isPending: false },
}));

vi.mock("@remix-run/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@remix-run/react")>()),
  useNavigate: () => navigate,
}));

vi.mock("~/api/mutations/admin/useNativeArchive", () => ({
  useNativeArchiveImport: () => ({
    mutate: submitImport,
    isPending: importMutation.isPending,
    isError: false,
  }),
  useNativeArchiveStatus: () => importStatus,
}));

describe("NativeArchiveImport", () => {
  beforeEach(async () => {
    submitImport.mockClear();
    navigate.mockClear();
    importStatus.data = null;
    importMutation.isPending = false;
    await i18next.changeLanguage("en");
  });

  it("submits the selected ZIP without requesting course metadata", async () => {
    renderWith({ withQuery: true }).render(<NativeArchiveImport />);
    const submitButton = screen.getByRole("button", { name: "Import Mentingo package" });
    expect(submitButton).toBeDisabled();
    expect(screen.getByText("Choose or drop a Mentingo package ZIP")).toBeInTheDocument();
    expect(screen.queryByText("Use a package exported from Mentingo. ZIP files only.")).toBeNull();

    const archiveFile = new File(["zip"], "course.zip", { type: "application/zip" });
    fireEvent.change(screen.getByLabelText("Select Mentingo package ZIP"), {
      target: { files: [archiveFile] },
    });

    await waitFor(() => expect(submitButton).toBeEnabled());
    fireEvent.click(submitButton);

    expect(submitImport).toHaveBeenCalledWith(
      expect.objectContaining({ file: archiveFile }),
      expect.any(Object),
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("uses the supplied return path for Cancel", () => {
    renderWith({ withQuery: true }).render(
      <MemoryRouter>
        <NativeArchiveImport cancelTo="/admin/beta-courses/new" />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      "/admin/beta-courses/new",
    );
  });

  it("follows the upload and then the import job with a step and progress", async () => {
    renderWith({ withQuery: true }).render(<NativeArchiveImport />);
    const archiveFile = new File(["zip"], "course.zip", { type: "application/zip" });
    fireEvent.change(screen.getByLabelText("Select Mentingo package ZIP"), {
      target: { files: [archiveFile] },
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Import Mentingo package" })).toBeEnabled(),
    );
    importMutation.isPending = true;
    fireEvent.click(screen.getByRole("button", { name: "Import Mentingo package" }));

    const [{ onUploadProgress }, { onSuccess }] = submitImport.mock.calls[0];
    act(() => onUploadProgress(42));

    expect(screen.getByText(/Step 1 of 2/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Uploading package" })).toBeInTheDocument();
    expect(screen.getByText("42%")).toBeInTheDocument();

    importMutation.isPending = false;
    importStatus.data = { state: "active", progress: { stage: "verifying", percent: 20 } };
    act(() => onSuccess("job-1"));

    expect(screen.getByText(/Step 2 of 2/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Checking package" })).toBeInTheDocument();
    expect(screen.getByText("20%")).toBeInTheDocument();
  });
});
