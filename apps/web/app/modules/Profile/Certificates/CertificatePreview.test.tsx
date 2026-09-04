import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import CertificatePreview from "./CertificatePreview";

const { certificateContentProps } = vi.hoisted(() => ({
  certificateContentProps: vi.fn(),
}));

vi.mock("~/api/mutations/useCreateCertificateShareLink", () => ({
  useCreateCertificateShareLink: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("~/api/mutations/useCreateLearningPathCertificateShareLink", () => ({
  useCreateLearningPathCertificateShareLink: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("./useCertificatePDF", () => ({
  default: () => ({ downloadCertificatePdf: vi.fn(), isPreparingDownload: false }),
}));

vi.mock("./CertificateControls", () => ({
  default: () => null,
}));

vi.mock("./CertificateContent", () => ({
  default: (props: Record<string, unknown>) => {
    certificateContentProps(props);
    return <div>Certificate content</div>;
  },
}));

describe("CertificatePreview", () => {
  it("formats completion and expiry dates consistently before rendering", () => {
    render(
      <CertificatePreview
        courseName="Product training"
        completionDate="2026-05-18T10:30:00.000Z"
        expiryDate="2027-05-18T10:30:00.000Z"
      />,
    );

    expect(screen.getByText("18.05.2026")).toBeInTheDocument();
    expect(certificateContentProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        completionDate: "18.05.2026",
        expiryDate: "18.05.2027",
      }),
    );
  });
});
