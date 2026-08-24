import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { CourseCertificateRowsTable } from "./CourseCertificateRowsTable";

const { certificatePreviewProps } = vi.hoisted(() => ({
  certificatePreviewProps: vi.fn(),
}));

vi.mock("~/api/queries/useCourseCertificateRows", () => ({
  useCourseCertificateRows: () => ({
    data: [
      {
        learnerName: "Alex Learner",
        learnerEmail: "alex@example.com",
        groups: ["Sales"],
        status: "active",
        issuedAt: "2026-08-20T10:00:00.000Z",
        expiresAt: null,
        courseTitle: "Product training",
        certificateSignatureUrl: "https://example.test/signature.png",
        certificateFontColor: "#123456",
        previewAllowed: true,
      },
    ],
    isFetching: false,
  }),
}));

vi.mock("~/api/queries/useGlobalSettings", () => ({
  useGlobalSettings: () => ({
    data: {
      certificateBackgroundImage: "https://example.test/certificate-background.png",
      platformLogoS3Key: "https://example.test/platform-logo.png",
    },
  }),
}));

vi.mock("~/modules/Profile/Certificates/CertificatePreview", () => ({
  default: (props: Record<string, unknown>) => {
    certificatePreviewProps(props);
    return <div>Certificate preview</div>;
  },
}));

describe("CourseCertificateRowsTable", () => {
  beforeEach(() => {
    certificatePreviewProps.mockClear();
  });

  it("uses the configured certificate background and platform logo in previews", () => {
    renderWith().render(<CourseCertificateRowsTable courseId="course-id" />);

    fireEvent.click(screen.getByRole("button", { name: "Preview certificate" }));

    expect(certificatePreviewProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        certificateBackgroundImageUrl: "https://example.test/certificate-background.png",
        platformLogo: "https://example.test/platform-logo.png",
      }),
    );
  });
});
