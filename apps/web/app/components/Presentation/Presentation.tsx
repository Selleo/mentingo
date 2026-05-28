import { useTranslation } from "react-i18next";

import { PdfPreviewViewer } from "~/components/RichText/extensions/pdfPreview/PdfPreviewViewer";

type PresentationProvider = "self" | "google" | "canva" | "unknown";

type PresentationProps = {
  url: string;
  isExternalUrl?: boolean;
  provider?: PresentationProvider;
};

const buildCanvaEmbedUrl = (rawUrl: string): string => {
  try {
    const url = new URL(rawUrl);
    if (!url.pathname.includes("/view") || !url.searchParams.has("/edit")) {
      const basePath = url.pathname.replace(/\/(edit|view).*$/, "");
      url.pathname = basePath.replace(/\/$/, "") + "/view";
    }
    url.search = "";
    url.searchParams.set("embed", "");
    return url.toString();
  } catch {
    return `${rawUrl}?embed`;
  }
};

export const buildPresentationPdfPreviewUrl = (rawUrl: string): string => {
  try {
    const baseUrl = typeof window === "undefined" ? "http://localhost" : window.location.origin;
    const url = new URL(rawUrl, baseUrl);
    url.searchParams.set("preview", "pdf");

    if (/^https?:\/\//i.test(rawUrl)) return url.toString();

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return `${rawUrl}${rawUrl.includes("?") ? "&" : "?"}preview=pdf`;
  }
};

export default function Presentation({
  url,
  isExternalUrl,
  provider = "unknown",
}: PresentationProps) {
  const { t } = useTranslation();

  if (isExternalUrl) {
    const iframeSrc = provider === "canva" ? buildCanvaEmbedUrl(url) : `${url}/embed`;
    return (
      <iframe
        title={t("richText.presentation.title")}
        src={iframeSrc}
        className="aspect-video w-full rounded-lg border border-neutral-200 bg-white"
        allowFullScreen
      />
    );
  }

  return (
    <PdfPreviewViewer
      src={buildPresentationPdfPreviewUrl(url)}
      name={t("richText.presentation.title")}
    />
  );
}
