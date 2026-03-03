import { useEffect, useState } from "react";

import { useCreateCertificateShareLink } from "~/api/mutations/useCreateCertificateShareLink";

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
  certificateId?: string;
  showShareButton?: boolean;
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
  certificateId,
  showShareButton = false,
  minimalFrame = false,
  initialColor,
  onColorChange,
}: CertificatePreviewProps) => {
  const { downloadCertificatePdf, isPreparingDownload } = useCertificatePDF();
  const { mutateAsync: createCertificateShareLink, isPending: isPreparingShare } =
    useCreateCertificateShareLink();
  const [toggled, setToggled] = useState<boolean>(false);
  const [colorTheme, setColorTheme] = useState<CertificateColorTheme>(
    getCertificateColorTheme(initialColor),
  );

  useEffect(() => {
    setColorTheme(getCertificateColorTheme(initialColor));
  }, [initialColor]);

  const lang = toggled ? "pl" : "en";

  const handleShareToLinkedIn = async () => {
    if (!certificateId || isPreparingShare) return;

    const { linkedinShareUrl } = await createCertificateShareLink({
      certificateId,
      language: lang,
    });

    window.open(linkedinShareUrl, "_blank", "noopener,noreferrer");
  };

  const handleDownloadCertificate = async () => {
    await downloadCertificatePdf({
      studentName,
      courseName,
      completionDate,
      platformLogo,
      backgroundImageUrl: certificateBackgroundImageUrl,
      signatureImageUrl: certificateSignatureUrl,
      lang,
      colorTheme,
    });
  };

  return (
    <>
      <div
        className={
          minimalFrame
            ? "mx-auto w-full bg-white"
            : "mx-auto w-full max-w-[95vw] overflow-hidden rounded-t-lg bg-white"
        }
      >
        <div
          className={
            minimalFrame
              ? "flex flex-wrap items-start justify-between gap-3 p-1"
              : "flex items-center justify-between bg-white p-4"
          }
        >
          <div className="flex flex-col items-start">
            <h2 className="font-medium text-primary-800">{courseName}</h2>
            <h2 className="text-sm text-gray-400">{completionDate}</h2>
          </div>

          <CertificateControls
            onClose={onClose}
            languageToggled={toggled}
            setLanguageToggled={setToggled}
            downloadCertificatePdf={handleDownloadCertificate}
            isPreparingDownload={isPreparingDownload}
            onShareToLinkedIn={handleShareToLinkedIn}
            isPreparingShare={isPreparingShare}
            colorTheme={colorTheme}
            setColorTheme={setColorTheme}
            onColorChange={onColorChange}
            showColorPicker={showColorPicker}
            showDownloadButton={showDownloadButton}
            showShareButton={showShareButton && Boolean(certificateId)}
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
