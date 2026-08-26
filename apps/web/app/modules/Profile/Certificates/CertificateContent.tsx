import { buildCertificateMarkup } from "@repo/shared";
import { useEffect, useRef, useState } from "react";

import { cn } from "~/lib/utils";

import { CERTIFICATE_KIND } from "./certificateKind";
import { defaultCertificateColorTheme } from "./certificateTheme";

import type { CertificateKind } from "./certificateKind";
import type { CertificateColorTheme } from "./certificateTheme";
import type { SupportedLanguages } from "@repo/shared";

interface CertificateContentProps {
  studentName?: string;
  courseName?: string;
  completionDate?: string;
  expiryDate?: string;
  isModal?: boolean;
  isDownload?: boolean;
  backgroundImageUrl?: string | null;
  platformLogo?: string | null;
  signatureImageUrl?: string | null;
  lang?: SupportedLanguages;
  colorTheme?: CertificateColorTheme;
  certificateKind?: CertificateKind;
}

const CertificateContent = ({
  studentName,
  courseName,
  completionDate,
  expiryDate,
  isModal,
  isDownload,
  backgroundImageUrl,
  platformLogo,
  signatureImageUrl,
  lang = "en",
  colorTheme = defaultCertificateColorTheme,
  certificateKind = CERTIFICATE_KIND.COURSE,
}: CertificateContentProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (isDownload) {
      setScale(1);
      return;
    }

    const element = containerRef.current;
    if (!element) return;

    const updateScale = () => {
      const nextScale = Math.min(element.clientWidth / 1200, 1);
      setScale(nextScale);
    };

    updateScale();

    const resizeObserver = new ResizeObserver(() => updateScale());
    resizeObserver.observe(element);

    return () => resizeObserver.disconnect();
  }, [isDownload]);

  const certificateBodyMarkup = buildCertificateMarkup({
    studentName,
    courseName,
    completionDate,
    expiryDate,
    platformLogoUrl: platformLogo,
    signatureImageUrl,
    backgroundImageUrl,
    lang,
    colorTheme,
    certificateKind,
  });

  const certificateBody = (
    <div className="h-full w-full" dangerouslySetInnerHTML={{ __html: certificateBodyMarkup }} />
  );

  if (isDownload) {
    return (
      <div className={cn("mx-auto h-[210mm] w-[297mm] overflow-hidden", !isModal && "rounded-lg")}>
        {certificateBody}
      </div>
    );
  }

  const baseHeight = (1200 * 210) / 297;

  return (
    <div
      ref={containerRef}
      className={cn("mx-auto w-full", !isModal && "max-w-full")}
      style={{ height: `${baseHeight * scale}px` }}
    >
      <div
        className={cn("origin-top-left overflow-hidden", !isModal && "rounded-lg")}
        style={{
          width: "1200px",
          height: `${baseHeight}px`,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {certificateBody}
      </div>
    </div>
  );
};

export default CertificateContent;
