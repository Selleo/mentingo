import { useRef } from "react";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import CertificateContent from "./CertificateContent";

interface CertificateToPDFProps {
  studentName?: string;
  courseName?: string;
  completionDate?: string;
  platformLogo?: string | null;
  backgroundImageUrl?: string | null;
}

const useCertificatePDF = () => {
  const { toast } = useToast();
  const { t } = useTranslation();

  const targetRef = useRef<HTMLDivElement>(null);

  const downloadCertificatePdf = async (courseName?: string) => {
    if (!targetRef.current) return;

    try {
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
      toast({ description: t("studentCertificateView.informations.failedToDownload") });
    }
  };

  const HiddenCertificate = ({
    studentName,
    courseName,
    completionDate,
    platformLogo,
    backgroundImageUrl,
  }: CertificateToPDFProps) => (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        opacity: 0,
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
          platformLogo={platformLogo}
          backgroundImageUrl={backgroundImageUrl}
        />
      </div>
    </div>
  );

  return { downloadCertificatePdf, HiddenCertificate };
};
export default useCertificatePDF;
