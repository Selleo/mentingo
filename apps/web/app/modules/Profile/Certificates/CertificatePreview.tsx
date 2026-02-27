import { useEffect, useState } from "react";

import CertificateContent from "./CertificateContent";
import CertificateControls from "./CertificateControls";
import { getCertificateColorTheme } from "./certificateTheme";
import useCertificatePDF from "./useCertificatePDF";

import type { CertificateColorTheme } from "./certificateTheme";

interface CertificatePreviewProps {
  studentName?: string;
  courseName?: string;
  completionDate?: string;
  onClose?: () => void;
  platformLogo?: string | null;
  certificateBackgroundImageUrl?: string | null;
  certificateSignatureUrl?: string | null;
  showColorPicker?: boolean;
  showDownloadButton?: boolean;
  minimalFrame?: boolean;
  initialColor?: string | null;
  onColorChange?: (color: string) => void;
}

const CertificatePreview = ({
  studentName,
  courseName,
  completionDate,
  onClose,
  platformLogo,
  certificateBackgroundImageUrl,
  certificateSignatureUrl,
  showColorPicker = false,
  showDownloadButton = true,
  minimalFrame = false,
  initialColor,
  onColorChange,
}: CertificatePreviewProps) => {
  const { HiddenCertificate, downloadCertificatePdf, isPreparingDownload } = useCertificatePDF();
  const [toggled, setToggled] = useState<boolean>(false);
  const [colorTheme, setColorTheme] = useState<CertificateColorTheme>(
    getCertificateColorTheme(initialColor),
  );

  useEffect(() => {
    setColorTheme(getCertificateColorTheme(initialColor));
  }, [initialColor]);

  const lang = toggled ? "pl" : "en";

  return (
    <>
      <HiddenCertificate
        studentName={studentName}
        courseName={courseName}
        completionDate={completionDate}
        platformLogo={platformLogo}
        lang={lang}
        backgroundImageUrl={certificateBackgroundImageUrl}
        signatureImageUrl={certificateSignatureUrl}
        colorTheme={colorTheme}
      />

      <div
        className={
          minimalFrame
            ? "mx-auto w-full"
            : "mx-auto w-full overflow-hidden rounded-xl border border-gray-200 bg-white"
        }
      >
        <div
          className={
            minimalFrame
              ? "flex flex-wrap items-start justify-between gap-3 p-1"
              : "flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 p-4"
          }
        >
          <div className="flex flex-col items-start">
            <h2 className="font-medium text-primary-800">{courseName}</h2>
            <h2 className="text-sm text-gray-400">{completionDate}</h2>
          </div>

          <CertificateControls
            onClose={onClose}
            courseName={courseName}
            languageToggled={toggled}
            setLanguageToggled={setToggled}
            downloadCertificatePdf={downloadCertificatePdf}
            isPreparingDownload={isPreparingDownload}
            colorTheme={colorTheme}
            setColorTheme={setColorTheme}
            onColorChange={onColorChange}
            showColorPicker={showColorPicker}
            showDownloadButton={showDownloadButton}
          />
        </div>

        <CertificateContent
          studentName={studentName}
          courseName={courseName}
          completionDate={completionDate}
          isModal
          platformLogo={platformLogo}
          backgroundImageUrl={certificateBackgroundImageUrl}
          signatureImageUrl={certificateSignatureUrl}
          lang={lang}
          colorTheme={colorTheme}
        />
      </div>
    </>
  );
};

export default CertificatePreview;
