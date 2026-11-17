import { fireEvent, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { ScormExportCard } from "../ScormExportCard";

const { exportScormCourse, downloadNativeArchive, jobStatus } = vi.hoisted(() => ({
  exportScormCourse: vi.fn(),
  downloadNativeArchive: vi.fn(),
  jobStatus: { data: null as unknown },
}));

vi.mock("~/api/mutations/admin/useExportScormCourse", () => ({
  useExportScormCourse: () => ({ mutate: exportScormCourse, isPending: false }),
}));

vi.mock("~/api/mutations/admin/useNativeArchive", () => ({
  downloadNativeArchive,
  useNativeArchiveStatus: () => jobStatus,
}));

const renderCard = () =>
  renderWith().render(
    <ScormExportCard courseId="course-1" language="en" unsupportedLessonCount={0} />,
  );

const startExport = () => {
  exportScormCourse.mockImplementation((_payload, { onSuccess }) => onSuccess("scorm-job"));
  fireEvent.click(screen.getByRole("button"));
};

describe("ScormExportCard", () => {
  beforeEach(() => {
    exportScormCourse.mockReset();
    downloadNativeArchive.mockReset().mockResolvedValue(undefined);
    jobStatus.data = null;
  });

  it("queues the export and shows progress while the package is built", () => {
    jobStatus.data = { state: "active", progress: { stage: "copying-files", percent: 40 } };
    renderCard();

    startExport();

    expect(exportScormCourse).toHaveBeenCalledWith(
      { courseId: "course-1", language: "en" },
      expect.anything(),
    );
    expect(screen.getByRole("status")).toHaveTextContent("40%");
    expect(screen.getByRole("button")).toBeDisabled();
    expect(downloadNativeArchive).not.toHaveBeenCalled();
  });

  it("downloads the package once its job completes", async () => {
    jobStatus.data = { state: "completed", progress: null };
    renderCard();

    startExport();

    await waitFor(() => expect(downloadNativeArchive).toHaveBeenCalledWith("scorm-job"));
    expect(downloadNativeArchive).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does not download a package whose job failed", () => {
    jobStatus.data = {
      state: "failed",
      failedReason: "adminCourseView.scormExport.error.missingAsset",
    };
    renderCard();

    startExport();

    expect(downloadNativeArchive).not.toHaveBeenCalled();
    expect(screen.getByRole("button")).toBeEnabled();
  });
});
