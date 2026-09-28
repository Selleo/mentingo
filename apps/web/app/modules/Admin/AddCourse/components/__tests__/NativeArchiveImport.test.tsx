import { fireEvent, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import i18next from "~/utils/mocks/i18next.mock";
import { renderWith } from "~/utils/testUtils";

import { NativeArchiveImport } from "../NativeArchiveImport";

const { submitImport, navigate } = vi.hoisted(() => ({
  submitImport: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@remix-run/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@remix-run/react")>()),
  useNavigate: () => navigate,
}));

vi.mock("~/api/mutations/admin/useNativeArchive", () => ({
  useNativeArchiveImport: () => ({ mutate: submitImport, isPending: false, isError: false }),
  useNativeArchiveStatus: () => ({ data: null }),
}));

describe("NativeArchiveImport", () => {
  beforeEach(async () => {
    submitImport.mockClear();
    navigate.mockClear();
    await i18next.changeLanguage("en");
  });

  it("submits the selected ZIP without requesting course metadata", async () => {
    renderWith({ withQuery: true }).render(<NativeArchiveImport />);
    const submitButton = screen.getByRole("button", { name: "Import Mentingo package" });
    expect(submitButton).toBeDisabled();

    const archiveFile = new File(["zip"], "course.zip", { type: "application/zip" });
    fireEvent.change(screen.getByLabelText("Select Mentingo package ZIP"), {
      target: { files: [archiveFile] },
    });

    await waitFor(() => expect(submitButton).toBeEnabled());
    fireEvent.click(submitButton);

    expect(submitImport).toHaveBeenCalledWith(archiveFile, expect.any(Object));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
