import { useState } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { useDownloadCertificatePdf } from "~/api/mutations/useDownloadCertificatePdf";
import { useDownloadLearningPathCertificatePdf } from "~/api/mutations/useDownloadLearningPathCertificatePdf";
import { useToast } from "~/components/ui/use-toast";

import { CERTIFICATE_KIND } from "./certificateKind";
import { extractFilenameFromContentDisposition } from "./utils/extractFilenameFromContentDisposition";

import type { CertificateKind } from "./certificateKind";
import type { SupportedLanguages } from "@repo/shared";

type CertificateToPDFProps = {
  certificateId?: string;
  lang: SupportedLanguages;
};

const triggerPdfDownload = (blob: Blob, filename: string) => {
  console.log(filename);
  const url = URL.createObjectURL(blob);
  const linkElement = document.createElement("a");

  linkElement.href = url;
  linkElement.download = filename;
  document.body.appendChild(linkElement);
  linkElement.click();
  document.body.removeChild(linkElement);

  URL.revokeObjectURL(url);
};

const useCertificatePDF = (certificateKind: CertificateKind = CERTIFICATE_KIND.COURSE) => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isPreparingDownload, setIsPreparingDownload] = useState(false);
  const { mutateAsync: downloadCertificatePdfMutation } = useDownloadCertificatePdf();
  const { mutateAsync: downloadLearningPathCertificatePdfMutation } =
    useDownloadLearningPathCertificatePdf();

  const downloadCertificatePdf = async ({ certificateId, lang }: CertificateToPDFProps) => {
    if (isPreparingDownload || !certificateId) return;

    try {
      setIsPreparingDownload(true);
      toast({ description: t("studentCertificateView.informations.preparingDownload") });

      const download = match(certificateKind)
        .with(CERTIFICATE_KIND.LEARNING_PATH, () => downloadLearningPathCertificatePdfMutation)
        .with(CERTIFICATE_KIND.COURSE, () => downloadCertificatePdfMutation)
        .exhaustive();

      const response = await download({
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
