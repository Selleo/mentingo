import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, vi } from "vitest";

import { Dialog } from "~/components/ui/dialog";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { triggerBrowserDownload } from "~/utils/downloadFile";
import i18next from "~/utils/mocks/i18next.mock";
import { renderWith } from "~/utils/testUtils";

import { USERS_IMPORT_MODAL_HANDLES } from "../../../../../../e2e/data/users/handles";

import { ImportUsersUpload } from "./ImportUsersUpload";

vi.mock("~/components/FileUploadInput/FileUploadInput", () => ({
  default: () => <div data-testid="mock-file-upload" />,
}));

vi.mock("~/utils/downloadFile", () => ({
  triggerBrowserDownload: vi.fn(),
}));

const importFile = new File(["firstName,lastName,email"], "users.csv", {
  type: "text/csv",
});

const readBlobText = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
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
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18next.changeLanguage("en");
    useLanguageStore.getState().setLanguage("en");
  });

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

  it("renders a sample file download action", () => {
    renderImportUsersUpload();

    expect(screen.getByTestId(USERS_IMPORT_MODAL_HANDLES.SAMPLE_DOWNLOAD)).toBeVisible();
  });

  it("downloads a localized english csv sample file with prepared columns and one example row", async () => {
    renderImportUsersUpload();

    fireEvent.click(screen.getByTestId(USERS_IMPORT_MODAL_HANDLES.SAMPLE_DOWNLOAD));

    expect(triggerBrowserDownload).toHaveBeenCalledOnce();

    const [blob, filename] = vi.mocked(triggerBrowserDownload).mock.calls[0];

    await expect(readBlobText(blob)).resolves.toBe(
      [
        "firstName,lastName,email,role,groups,language",
        'Sample,Student,sample.student@example.com,student,"group1,group2",en',
      ].join("\n"),
    );
    expect(filename).toBe("users-import-sample.csv");
  });

  it("downloads a localized polish csv sample file", async () => {
    await i18next.changeLanguage("pl");
    useLanguageStore.getState().setLanguage("pl");
    renderImportUsersUpload();

    fireEvent.click(screen.getByTestId(USERS_IMPORT_MODAL_HANDLES.SAMPLE_DOWNLOAD));

    const [blob, filename] = vi.mocked(triggerBrowserDownload).mock.calls[0];

    await expect(readBlobText(blob)).resolves.toBe(
      [
        "firstName,lastName,email,role,groups,language",
        'Jan,Kowalski,jan.kowalski@example.com,student,"grupa1,grupa2",pl',
      ].join("\n"),
    );
    expect(filename).toBe("przyklad-importu-uzytkownikow.csv");
  });
});
