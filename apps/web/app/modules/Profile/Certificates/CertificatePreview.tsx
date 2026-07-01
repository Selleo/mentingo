import { SUPPORTED_LANGUAGES, type SupportedLanguages } from "@repo/shared";
import { useEffect, useState } from "react";
import { match } from "ts-pattern";

import { useCreateCertificateShareLink } from "~/api/mutations/useCreateCertificateShareLink";
import { useCreateLearningPathCertificateShareLink } from "~/api/mutations/useCreateLearningPathCertificateShareLink";
import { cn } from "~/lib/utils";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import CertificateContent from "./CertificateContent";
import CertificateControls from "./CertificateControls";
import { CERTIFICATE_KIND } from "./certificateKind";
import { getCertificateColorTheme } from "./certificateTheme";
import useCertificatePDF from "./useCertificatePDF";

import type { CertificateKind } from "./certificateKind";
import type { CertificateColorTheme } from "./certificateTheme";

interface CertificatePreviewProps {
  studentName?: string;
  courseName?: string;
  completionDate?: string;
  expiryDate?: string;
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
  onColorPickerOpenChange?: (isOpen: boolean) => void;
  certificateKind?: CertificateKind;
}

const CertificatePreview = ({
  studentName,
  courseName,
  completionDate,
  expiryDate,
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
  onColorPickerOpenChange,
  certificateKind = CERTIFICATE_KIND.COURSE,
}: CertificatePreviewProps) => {
  const currentLanguage = useLanguageStore((state) => state.language);
  const { downloadCertificatePdf, isPreparingDownload } = useCertificatePDF(certificateKind);
  const { mutateAsync: createCertificateShareLink, isPending: isPreparingShare } =
    useCreateCertificateShareLink();
  const {
    mutateAsync: createLearningPathCertificateShareLink,
    isPending: isPreparingLearningPathShare,
  } = useCreateLearningPathCertificateShareLink();
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguages>(
    currentLanguage || SUPPORTED_LANGUAGES.EN,
  );
  const [colorTheme, setColorTheme] = useState<CertificateColorTheme>(
    getCertificateColorTheme(initialColor),
  );

  useEffect(() => {
    setColorTheme(getCertificateColorTheme(initialColor));
  }, [initialColor]);

  const handleShareToLinkedIn = async () => {
    if (!certificateId || isPreparingShare || isPreparingLearningPathShare) return;

    const createShareLink = match(certificateKind)
      .with(CERTIFICATE_KIND.LEARNING_PATH, () => createLearningPathCertificateShareLink)
      .with(CERTIFICATE_KIND.COURSE, () => createCertificateShareLink)
      .exhaustive();
    const { linkedinShareUrl } = await createShareLink({
      certificateId,
      language: selectedLanguage,
    });

    window.open(linkedinShareUrl, "_blank", "noopener,noreferrer");
  };

  const handleDownloadCertificate = async () => {
    await downloadCertificatePdf({ certificateId, lang: selectedLanguage });
  };

  return (
    <div className="flex max-h-[90vh] w-[min(1120px,95vw)] justify-center overflow-y-auto">
      <div className="w-full pr-1">
        <div
          className={cn("mx-auto w-full bg-white", {
            "rounded-t-lg": !minimalFrame,
            "overflow-hidden": !minimalFrame && !showColorPicker,
            "overflow-visible": !minimalFrame && showColorPicker,
          })}
        >
          <div
            className={cn("flex justify-between", {
              "flex-wrap items-start gap-3 p-1": minimalFrame,
              "items-center bg-white p-2 sm:p-4": !minimalFrame,
            })}
          >
            <div className="flex flex-col items-start">
              <h2 className="font-medium text-primary-800">{courseName}</h2>
              <h2 className="text-sm text-gray-400">{completionDate}</h2>
            </div>

            <CertificateControls
              onClose={onClose}
              selectedLanguage={selectedLanguage}
              setSelectedLanguage={setSelectedLanguage}
              downloadCertificatePdf={handleDownloadCertificate}
              isPreparingDownload={isPreparingDownload}
              onShareToLinkedIn={handleShareToLinkedIn}
              isPreparingShare={isPreparingShare || isPreparingLearningPathShare}
              colorTheme={colorTheme}
              setColorTheme={setColorTheme}
              onColorChange={onColorChange}
              onColorPickerOpenChange={onColorPickerOpenChange}
              showColorPicker={showColorPicker}
              showDownloadButton={showDownloadButton}
              showShareButton={showShareButton && Boolean(certificateId)}
            />
          </div>

          <CertificateContent
            studentName={studentName}
            courseName={courseName}
            completionDate={completionDate}
            expiryDate={expiryDate}
            isModal
            platformLogo={platformLogo}
            backgroundImageUrl={certificateBackgroundImageUrl}
            signatureImageUrl={certificateSignatureUrl}
            lang={selectedLanguage}
            colorTheme={colorTheme}
            certificateKind={certificateKind}
          />
        </div>
      </div>
    </div>
  );
};

export default CertificatePreview;
