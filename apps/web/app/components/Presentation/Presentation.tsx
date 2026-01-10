import DocViewer, { DocViewerRenderers } from "@cyntler/react-doc-viewer";
import "@cyntler/react-doc-viewer/dist/index.css";

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

export default function Presentation({
  url,
  isExternalUrl,
  provider = "unknown",
}: PresentationProps) {
  const docs = [
    {
      uri: url,
      fileType: "pptx",
      fileName: "Presentation",
    },
  ];

  if (isExternalUrl) {
    const iframeSrc = provider === "canva" ? buildCanvaEmbedUrl(url) : `${url}/embed`;
    return <iframe title="Presentation" src={iframeSrc} className="aspect-video" allowFullScreen />;
  }

  return (
    <DocViewer
      documents={docs}
      pluginRenderers={DocViewerRenderers}
      config={{
        header: {
          disableFileName: false,
        },
      }}
    />
  );
}
