import { buildCertificateMarkup } from "@repo/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

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

  const downloadCertificatePdf = async ({
    studentName,
    courseName,
    completionDate,
    platformLogo,
    backgroundImageUrl,
    signatureImageUrl,
    lang,
    colorTheme,
  }: CertificateToPDFProps) => {
    if (isPreparingDownload) return;

    try {
      setIsPreparingDownload(true);
      toast({ description: t("studentCertificateView.informations.preparingDownload") });

      const filename = `${courseName || "certificate"}.pdf`;
      const html = buildCertificateMarkup({
        studentName,
        courseName,
        completionDate,
        platformLogoUrl: platformLogo,
        backgroundImageUrl,
        signatureImageUrl,
        isDownload: true,
        lang,
        colorTheme,
      });

      const response = await fetch("/api/certificates/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          html,
          filename,
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
      linkElement.download = filename;
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

  const HiddenCertificate = (_props: CertificateToPDFProps) => null;

  return { downloadCertificatePdf, HiddenCertificate, isPreparingDownload };
};
export default useCertificatePDF;
