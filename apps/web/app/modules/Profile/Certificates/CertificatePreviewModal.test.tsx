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
});
