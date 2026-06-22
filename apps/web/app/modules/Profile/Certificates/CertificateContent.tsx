import { useEffect, useRef, useState } from "react";

import { Icon } from "~/components/Icon";
import { cn } from "~/lib/utils";

import { CERTIFICATE_KIND } from "./certificateKind";
import { defaultCertificateColorTheme } from "./certificateTheme";

import type { CertificateKind } from "./certificateKind";
import type { CertificateColorTheme } from "./certificateTheme";

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
  lang?: "pl" | "en";
  colorTheme?: CertificateColorTheme;
  certificateKind?: CertificateKind;
}

const translations = {
  pl: {
    certificate: "CERTYFIKAT",
    certifyThat: "NINIEJSZYM ZAŚWIADCZA SIĘ, ŻE",
    successfulCompletion: {
      [CERTIFICATE_KIND.COURSE]: "ukończył/a kurs",
      [CERTIFICATE_KIND.LEARNING_PATH]: "ukończył/a ścieżkę rozwoju",
    },
    confirmation: "potwierdzając tym samym realizację programu szkoleniowego.",
    date: "Data",
    expiryDate: "Wygasa",
    signature: "Podpis",
  },
  en: {
    certificate: "CERTIFICATE",
    certifyThat: "THIS IS TO CERTIFY THAT",
    successfulCompletion: {
      [CERTIFICATE_KIND.COURSE]: "has successfully completed the course",
      [CERTIFICATE_KIND.LEARNING_PATH]: "has successfully completed the development path",
    },
    confirmation: "thereby confirming participation in the full training program.",
    date: "Date",
    expiryDate: "Expires",
    signature: "Signature",
  },
};
const hrClasses = "mx-auto mb-3 w-full";
const textClasses = "text-[18px] uppercase text-gray-800";
const text2Classes = "text-[18px] text-gray-600";
const signatureClasses = "flex w-[280px] flex-col items-center";
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

  const certificateBody = (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-y-12 px-14 py-12"
      style={{
        backgroundImage: backgroundImageUrl ? `url(${backgroundImageUrl})` : undefined,
        backgroundSize: "100% 100%",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundColor: backgroundImageUrl ? undefined : "white",
      }}
    >
      {platformLogo ? (
        <img src={platformLogo} alt="Platform Logo" className="aspect-auto h-11" />
      ) : (
        <Icon name="AppLogo" className="h-11" style={{ color: colorTheme.logoColor }} />
      )}

      <div className="flex flex-col items-center justify-center gap-y-4">
        <p
          className="text-[62px] font-black uppercase tracking-wider"
          style={{ color: colorTheme.titleColor }}
        >
          {translations[lang].certificate}
        </p>
        <p
          className="text-[17px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: colorTheme.certifyTextColor }}
        >
          {translations[lang].certifyThat}
        </p>
      </div>

      <div className="flex flex-col items-center justify-center">
        <p className="mb-4 text-[44px] tracking-wider" style={{ color: colorTheme.nameColor }}>
          {studentName}
        </p>
        <p className={text2Classes} style={{ color: colorTheme.bodyTextColor }}>
          {translations[lang].successfulCompletion[certificateKind]}
        </p>
        <p className="text-[24px]" style={{ color: colorTheme.courseNameColor }}>
          &quot;{courseName}&quot;
        </p>
        <p className={text2Classes} style={{ color: colorTheme.bodyTextColor }}>
          {translations[lang].confirmation}
        </p>
      </div>

      <div className={cn("flex items-end", expiryDate ? "gap-x-16" : "gap-x-52")}>
        <div className={signatureClasses}>
          <p className={text2Classes} style={{ color: colorTheme.bodyTextColor }}>
            {completionDate}
          </p>
          <hr className={hrClasses} style={{ borderColor: colorTheme.lineColor }} />
          <p className={textClasses} style={{ color: colorTheme.labelTextColor }}>
            {translations[lang].date}
          </p>
        </div>

        {expiryDate && (
          <div className={signatureClasses}>
            <p className={text2Classes} style={{ color: colorTheme.bodyTextColor }}>
              {expiryDate}
            </p>
            <hr className={hrClasses} style={{ borderColor: colorTheme.lineColor }} />
            <p className={textClasses} style={{ color: colorTheme.labelTextColor }}>
              {translations[lang].expiryDate}
            </p>
          </div>
        )}

        <div className={signatureClasses}>
          {signatureImageUrl && (
            <img
              src={signatureImageUrl}
              alt={translations[lang].signature}
              className="mb-2 h-16 w-full object-contain"
            />
          )}
          <hr className={hrClasses} style={{ borderColor: colorTheme.lineColor }} />
          <p className={textClasses} style={{ color: colorTheme.labelTextColor }}>
            {translations[lang].signature}
          </p>
        </div>
      </div>
    </div>
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
