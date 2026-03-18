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

const CERTIFICATE_DOWNLOAD_ENDPOINT = "/api/certificates/download";

const toAbsoluteUrl = (value?: string | null): string | null => {
  if (!value) return null;

  if (typeof window === "undefined") return value;

  try {
    return new URL(value, window.location.origin).toString();
  } catch {
    return value;
  }
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Failed to read image data"));
    };
    reader.onerror = () => reject(new Error("Failed to read image data"));
    reader.readAsDataURL(blob);
  });

const toEmbeddableImageSource = async (value?: string | null): Promise<string | null> => {
  const absoluteUrl = toAbsoluteUrl(value);
  if (!absoluteUrl) return null;

  try {
    const response = await fetch(absoluteUrl);
    if (!response.ok) return absoluteUrl;

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) return absoluteUrl;

    const blob = await response.blob();
    return await blobToDataUrl(blob);
  } catch {
    return absoluteUrl;
  }
};

const buildCertificateFilename = (courseName?: string): string =>
  `${courseName || "certificate"}.pdf`;

const prepareCertificateImageSources = async (options: {
  platformLogo?: string | null;
  backgroundImageUrl?: string | null;
  signatureImageUrl?: string | null;
}) => {
  const [platformLogoUrl, backgroundImageUrl, signatureImageUrl] = await Promise.all([
    toEmbeddableImageSource(options.platformLogo),
    toEmbeddableImageSource(options.backgroundImageUrl),
    toEmbeddableImageSource(options.signatureImageUrl),
  ]);

  return { platformLogoUrl, backgroundImageUrl, signatureImageUrl };
};

const resolveApiErrorMessage = async (
  response: Response,
  fallbackMessage: string,
  translate: (key: string, options?: { defaultValue?: string }) => string,
) => {
  const errorResponse = (await response.json().catch(() => null)) as {
    message?: string;
  } | null;
  const apiMessage = errorResponse?.message;

  if (apiMessage) return translate(apiMessage, { defaultValue: fallbackMessage });

  return fallbackMessage;
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

      const imageSources = await prepareCertificateImageSources({
        platformLogo,
        backgroundImageUrl,
        signatureImageUrl,
      });

      const filename = buildCertificateFilename(courseName);
      const html = buildCertificateMarkup({
        studentName,
        courseName,
        completionDate,
        ...imageSources,
        isDownload: true,
        lang,
        colorTheme,
      });

      const response = await fetch(CERTIFICATE_DOWNLOAD_ENDPOINT, {
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
        throw new Error(
          await resolveApiErrorMessage(
            response,
            t("studentCertificateView.informations.failedToDownload"),
            t,
          ),
        );
      }

      const blob = await response.blob();
      triggerPdfDownload(blob, filename);
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
