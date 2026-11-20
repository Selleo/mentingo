import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
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
    expect(downloadButton).toHaveClass("h-12");
  });

  it("downloads the certificate and closes the preview when the buttons are clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const downloadCertificatePdf = vi.fn().mockResolvedValue(undefined);

    renderWith().render(
      <CertificateControls
        onClose={onClose}
        selectedLanguage={SUPPORTED_LANGUAGES.EN}
        setSelectedLanguage={vi.fn()}
        downloadCertificatePdf={downloadCertificatePdf}
        isPreparingDownload={false}
        colorTheme={getCertificateColorTheme(null)}
        setColorTheme={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Download certificate (PDF)" }));
    expect(downloadCertificatePdf).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the download button named but disabled while the PDF is being prepared", () => {
    renderWith().render(
      <CertificateControls
        selectedLanguage={SUPPORTED_LANGUAGES.EN}
        setSelectedLanguage={vi.fn()}
        downloadCertificatePdf={vi.fn().mockResolvedValue(undefined)}
        isPreparingDownload
        colorTheme={getCertificateColorTheme(null)}
        setColorTheme={vi.fn()}
      />,
    );

    const downloadButton = screen.getByRole("button", { name: "Download certificate (PDF)" });

    expect(downloadButton).toBeDisabled();
    expect(downloadButton).toHaveTextContent("Download certificate (PDF)");
  });
});
