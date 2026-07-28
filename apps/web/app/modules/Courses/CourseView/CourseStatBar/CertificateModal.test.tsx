import { act, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import CertificateModal from "./CertificateModal";

const { courseSettings, updateCourseSettings, updateHasCertificate } = vi.hoisted(() => ({
  courseSettings: {} as { certificateSignatureUrl?: string },
  updateCourseSettings: vi.fn(),
  updateHasCertificate: vi.fn(),
}));

vi.mock("~/api/mutations/useUpdateCourseSettings", () => ({
  useUpdateCourseSettings: () => ({
    mutate: updateCourseSettings,
    isPending: false,
  }),
}));

vi.mock("~/api/mutations/useUpdateHasCertificate", () => ({
  useUpdateHasCertificate: () => ({
    mutate: updateHasCertificate,
    isPending: false,
  }),
}));

vi.mock("~/api/queries", () => ({
  useCurrentUser: () => ({ data: { firstName: "Alex", lastName: "Taylor" } }),
}));

vi.mock("~/api/queries/useCourseSettings", () => ({
  useCourseSettings: () => ({ data: courseSettings, isLoading: false }),
}));

vi.mock("~/api/queries/useGlobalSettings", () => ({
  useGlobalSettings: () => ({ data: {} }),
}));

vi.mock("~/components/FileUploadInput/ImageUploadInput", () => ({
  default: ({
    disabled,
    handleImageUpload,
  }: {
    disabled?: boolean;
    handleImageUpload: (file: File) => void;
  }) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() =>
        handleImageUpload(new File(["signature"], "signature.png", { type: "image/png" }))
      }
    >
      Upload signature test file
    </button>
  ),
}));

vi.mock("../../context/CourseAccessProvider", () => ({
  useCourseAccessProvider: () => ({ course: { id: "course-1" } }),
}));

vi.mock(
  "~/modules/Admin/EditCourse/CourseSettings/components/useCertificateValiditySettings",
  () => ({
    useCertificateValiditySettings: () => ({
      isValidityEnabled: true,
      validityType: "period",
      validityValue: 1,
      validityUnit: "years",
      validityDate: "",
      validityImpact: null,
      isValidityImpactOpen: true,
      validityDateError: null,
      hasValidityChanges: false,
      isCheckingValidityImpact: false,
      isUpdatingCourseSettings: false,
      setIsValidityEnabled: vi.fn(),
      setValidityType: vi.fn(),
      setValidityValue: vi.fn(),
      setValidityUnit: vi.fn(),
      setValidityDate: vi.fn(),
      setIsValidityImpactOpen: vi.fn(),
      saveValidity: vi.fn(),
      handleValiditySave: vi.fn(),
    }),
  }),
);

vi.mock("~/modules/Admin/EditCourse/CourseSettings/components/CertificateValiditySection", () => ({
  CertificateValiditySection: ({ disabled }: { disabled: boolean }) => (
    <button type="button" disabled={disabled}>
      Certificate validity
    </button>
  ),
}));

vi.mock(
  "~/modules/Admin/EditCourse/CourseSettings/components/CertificateValidityImpactDialog",
  () => ({
    CertificateValidityImpactDialog: ({ open }: { open: boolean }) =>
      open && <div>Validity impact dialog</div>,
  }),
);

vi.mock("~/modules/Profile/Certificates/CertificatePreview", () => ({
  default: ({
    onColorChange,
    onColorPickerOpenChange,
  }: {
    onColorChange?: (color: string) => void;
    onColorPickerOpenChange?: (isOpen: boolean) => void;
  }) => (
    <div>
      Certificate preview dialog
      <button
        type="button"
        onClick={() => {
          onColorPickerOpenChange?.(true);
          onColorChange?.("#ABCDEF");
        }}
      >
        Change certificate color
      </button>
      <button type="button" onClick={() => onColorPickerOpenChange?.(false)}>
        Close certificate color picker
      </button>
    </div>
  ),
}));

describe("CertificateModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete courseSettings.certificateSignatureUrl;
  });

  it("opens the certificate preview and renders the validity impact dialog", async () => {
    const user = userEvent.setup();

    renderWith().render(
      <CertificateModal courseTitle="Security training" hasCertificate onClose={vi.fn()} />,
    );

    expect(screen.getByText("Validity impact dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Upload signature test file" }));

    expect(updateCourseSettings).toHaveBeenCalledWith({
      courseId: "course-1",
      data: {
        certificateSignature: expect.any(File),
      },
    });

    await user.click(screen.getByRole("button", { name: "Preview" }));

    expect(screen.getByText("Certificate preview dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Change certificate color" }));

    expect(updateCourseSettings).not.toHaveBeenCalledWith({
      courseId: "course-1",
      data: {
        certificateFontColor: "#abcdef",
      },
    });

    await user.click(screen.getByRole("button", { name: "Close certificate color picker" }));

    expect(updateCourseSettings).toHaveBeenCalledWith(
      {
        courseId: "course-1",
        data: {
          certificateFontColor: "#abcdef",
        },
      },
      expect.objectContaining({
        onError: expect.any(Function),
        onSuccess: expect.any(Function),
      }),
    );

    await user.keyboard("{Escape}");

    const certificateSwitch = screen.getByRole("switch", { name: "Enable certificate" });

    await user.click(certificateSwitch);

    expect(updateHasCertificate).toHaveBeenCalledWith(
      {
        courseId: "course-1",
        data: { hasCertificate: false },
      },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
    expect(certificateSwitch).toHaveAttribute("aria-checked", "false");

    act(() => {
      updateHasCertificate.mock.calls[0]?.[1]?.onError();
    });

    expect(certificateSwitch).toHaveAttribute("aria-checked", "true");
  });

  it("keeps certificate options visible and disables them when certificates are disabled", () => {
    renderWith().render(
      <CertificateModal courseTitle="Security training" hasCertificate={false} onClose={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: "Certificate validity" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Preview" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Upload signature test file" })).toBeDisabled();
  });

  it("places signature removal next to the upload without shrinking the upload", () => {
    courseSettings.certificateSignatureUrl = "https://example.com/signature.png";

    renderWith().render(
      <CertificateModal courseTitle="Security training" hasCertificate onClose={vi.fn()} />,
    );

    const upload = screen.getByRole("button", { name: "Upload signature test file" });
    const remove = screen.getByRole("button", { name: "Remove signature" });

    expect(upload.parentElement).toHaveClass("max-w-xl", "flex-none");
    expect(upload.parentElement?.parentElement).toContainElement(remove);
  });

  it("closes with Escape and returns focus handling to the caller", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderWith().render(
      <CertificateModal courseTitle="Security training" hasCertificate onClose={onClose} />,
    );

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledOnce();
  });
});
