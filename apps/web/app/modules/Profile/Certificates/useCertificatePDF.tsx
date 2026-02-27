import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import CertificateContent from "./CertificateContent";

import type { CertificateColorTheme } from "./certificateTheme";

interface CertificateToPDFProps {
  studentName?: string;
  courseName?: string;
  completionDate?: string;
  platformLogo?: string | null;
  backgroundImageUrl?: string | null;
  signatureImageUrl?: string | null;
  lang: "pl" | "en";
  colorTheme?: CertificateColorTheme;
}

const useCertificatePDF = () => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isPreparingDownload, setIsPreparingDownload] = useState(false);

  const targetRef = useRef<HTMLDivElement>(null);

  const downloadCertificatePdf = async (courseName?: string) => {
    if (!targetRef.current || isPreparingDownload) return;

    try {
      setIsPreparingDownload(true);
      toast({ description: t("studentCertificateView.informations.preparingDownload") });

      const response = await fetch("/api/certificates/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          html: targetRef.current.innerHTML,
          filename: `${courseName || "certificate"}.pdf`,
        }),
      });

      if (!response.ok) {
        const errorResponse = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        const apiMessage = errorResponse?.message;

        if (apiMessage) {
          throw new Error(
            t(apiMessage, {
              defaultValue: t("studentCertificateView.informations.failedToDownload"),
            }),
          );
        }

        throw new Error(t("studentCertificateView.informations.failedToDownload"));
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const linkElement = document.createElement("a");
      linkElement.href = url;
      linkElement.download = `${courseName || "certificate"}.pdf`;
      document.body.appendChild(linkElement);
      linkElement.click();
      document.body.removeChild(linkElement);
      URL.revokeObjectURL(url);
    } catch (error) {
      const description =
        error instanceof Error
          ? error.message
          : t("studentCertificateView.informations.failedToDownload");
      toast({ description });
    } finally {
      setIsPreparingDownload(false);
    }
  };

  const HiddenCertificate = ({
    studentName,
    courseName,
    completionDate,
    platformLogo,
    backgroundImageUrl,
    signatureImageUrl,
    lang,
    colorTheme,
  }: CertificateToPDFProps) => (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        opacity: 0,
        visibility: "hidden",
        pointerEvents: "none",
        width: "297mm",
        height: "210mm",
      }}
    >
      <div
        ref={targetRef}
        style={{ width: "297mm", height: "210mm" }}
        data-student-name={studentName}
        data-course-name={courseName}
        data-completion-date={completionDate}
        data-background-image={backgroundImageUrl}
        data-platform-logo={platformLogo}
      >
        <CertificateContent
          studentName={studentName}
          courseName={courseName}
          completionDate={completionDate}
          isDownload={true}
          lang={lang}
          platformLogo={platformLogo}
          backgroundImageUrl={backgroundImageUrl}
          signatureImageUrl={signatureImageUrl}
          colorTheme={colorTheme}
        />
      </div>
    </div>
  );

  return { downloadCertificatePdf, HiddenCertificate, isPreparingDownload };
};
export default useCertificatePDF;
