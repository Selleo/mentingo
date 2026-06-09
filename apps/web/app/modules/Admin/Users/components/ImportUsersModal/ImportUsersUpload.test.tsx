import { fireEvent, screen } from "@testing-library/react";
import { vi } from "vitest";

import { Dialog } from "~/components/ui/dialog";
import { renderWith } from "~/utils/testUtils";

import { USERS_IMPORT_MODAL_HANDLES } from "../../../../../../e2e/data/users/handles";

import { ImportUsersUpload } from "./ImportUsersUpload";

vi.mock("~/components/FileUploadInput/FileUploadInput", () => ({
  default: () => <div data-testid="mock-file-upload" />,
}));

const importFile = new File(["firstName,lastName,email"], "users.csv", {
  type: "text/csv",
});

const renderImportUsersUpload = ({
  file = importFile,
  isImportingUsers = false,
  handleUsersImport = vi.fn(),
}: {
  file?: File | null;
  isImportingUsers?: boolean;
  handleUsersImport?: () => void;
} = {}) => {
  renderWith().render(
    <Dialog open>
      <ImportUsersUpload
        file={file}
        setFile={vi.fn()}
        fileUrl={undefined}
        setFileUrl={vi.fn()}
        handleUsersImport={handleUsersImport}
        isImportingUsers={isImportingUsers}
      />
    </Dialog>,
  );

  return { handleUsersImport };
};

describe("ImportUsersUpload", () => {
  it("disables the import button while the import request is pending", () => {
    renderImportUsersUpload({ isImportingUsers: true });

    expect(screen.getByTestId(USERS_IMPORT_MODAL_HANDLES.SUBMIT)).toBeDisabled();
  });

  it("keeps the import button enabled when a file is selected and no request is pending", () => {
    renderImportUsersUpload();

    expect(screen.getByTestId(USERS_IMPORT_MODAL_HANDLES.SUBMIT)).toBeEnabled();
  });

  it("does not submit again while the import button is disabled", () => {
    const { handleUsersImport } = renderImportUsersUpload({ isImportingUsers: true });

    fireEvent.click(screen.getByTestId(USERS_IMPORT_MODAL_HANDLES.SUBMIT));

    expect(handleUsersImport).not.toHaveBeenCalled();
  });
});
