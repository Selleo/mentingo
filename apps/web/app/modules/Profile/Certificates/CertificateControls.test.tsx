import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import CertificateControls from "./CertificateControls";
import { getCertificateColorTheme } from "./certificateTheme";

describe("CertificateControls", () => {
  it("names the close button and shows the download action as a labelled button", () => {
    renderWith().render(
      <CertificateControls
        onClose={vi.fn()}
        selectedLanguage={SUPPORTED_LANGUAGES.EN}
        setSelectedLanguage={vi.fn()}
        downloadCertificatePdf={vi.fn().mockResolvedValue(undefined)}
        isPreparingDownload={false}
        colorTheme={getCertificateColorTheme(null)}
        setColorTheme={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();

    const downloadButton = screen.getByRole("button", { name: "Download certificate (PDF)" });

    expect(downloadButton).toHaveTextContent("Download certificate (PDF)");
    expect(downloadButton).toHaveClass("h-11");
  });
});
