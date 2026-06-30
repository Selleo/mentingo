import { SUPPORTED_LANGUAGES, type SupportedLanguages } from "@repo/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CertificateContent from "./CertificateContent";

describe("CertificateContent", () => {
  it("renders certificate copy in every supported language", () => {
    const expectedLabels = {
      [SUPPORTED_LANGUAGES.EN]: "THIS IS TO CERTIFY THAT",
      [SUPPORTED_LANGUAGES.PL]: "NINIEJSZYM ZAŚWIADCZA SIĘ, ŻE",
      [SUPPORTED_LANGUAGES.DE]: "HIERMIT WIRD BESTÄTIGT, DASS",
      [SUPPORTED_LANGUAGES.LT]: "ŠIUO PATVIRTINAMA, KAD",
      [SUPPORTED_LANGUAGES.CS]: "TÍMTO SE POTVRZUJE, ŽE",
      [SUPPORTED_LANGUAGES.ES]: "SE CERTIFICA QUE",
    };

    for (const [language, label] of Object.entries(expectedLabels)) {
      const { unmount } = render(
        <CertificateContent
          isDownload
          lang={language as SupportedLanguages}
          studentName="Ada Lovelace"
          courseName="Analytical Engines"
          completionDate="30.06.2026"
        />,
      );

      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });
});
