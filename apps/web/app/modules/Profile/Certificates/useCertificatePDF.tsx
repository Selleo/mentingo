import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useDownloadCertificatePdf } from "~/api/mutations/useDownloadCertificatePdf";
import { useToast } from "~/components/ui/use-toast";

import { extractFilenameFromContentDisposition } from "./utils/extractFilenameFromContentDisposition";

import type { SupportedLanguages } from "@repo/shared";

type CertificateToPDFProps = {
  certificateId?: string;
  lang: SupportedLanguages;
};

const triggerPdfDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const linkElement = document.createElement("a");

  linkElement.href = url;
  linkElement.download = filename;
  document.body.appendChild(linkElement);
  linkElement.click();
  document.body.removeChild(linkElement);

  URL.revokeObjectURL(url);
};

const useCertificatePDF = () => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isPreparingDownload, setIsPreparingDownload] = useState(false);
  const { mutateAsync: downloadCertificatePdfMutation } = useDownloadCertificatePdf();

  const downloadCertificatePdf = async ({ certificateId, lang }: CertificateToPDFProps) => {
    if (isPreparingDownload || !certificateId) return;

    try {
      setIsPreparingDownload(true);
      toast({ description: t("studentCertificateView.informations.preparingDownload") });

      const response = await downloadCertificatePdfMutation({
        certificateId,
        language: lang,
      });

      const blob = response.data;
      const filename =
        extractFilenameFromContentDisposition(response.headers["content-disposition"]) ||
        "certificate.pdf";

      triggerPdfDownload(blob, filename);
    } catch (error) {
      const description = t("studentCertificateView.informations.failedToDownload");
      toast({ description });
    } finally {
      setIsPreparingDownload(false);
    }
  };

  return { downloadCertificatePdf, isPreparingDownload };
};
export default useCertificatePDF;
