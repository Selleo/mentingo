import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { CertificatePreviewModal } from "./CertificatePreviewModal";

vi.mock("./CertificatePreview", () => ({
  default: () => <div data-testid="certificate-preview" />,
}));

describe("CertificatePreviewModal", () => {
  it("centers the certificate preview inside the dialog", () => {
    renderWith().render(<CertificatePreviewModal open onOpenChange={vi.fn()} />);

    expect(screen.getByTestId("certificate-preview").parentElement).toHaveClass(
      "items-center",
      "justify-center",
      "w-[min(1120px,95vw)]",
    );
  });

  it("names the dialog after the course, or generically when the course name is missing", () => {
    const { rerender } = renderWith().render(
      <CertificatePreviewModal open onOpenChange={vi.fn()} courseName="Safety basics" />,
    );

    expect(screen.getByRole("dialog", { name: "Safety basics" })).toBeInTheDocument();

    rerender(<CertificatePreviewModal open onOpenChange={vi.fn()} courseName="" />);

    expect(screen.getByRole("dialog", { name: "Certificate preview" })).toBeInTheDocument();
  });
});
