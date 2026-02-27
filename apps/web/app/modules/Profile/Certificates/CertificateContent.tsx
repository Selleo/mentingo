import { useEffect, useRef, useState } from "react";

import { Icon } from "~/components/Icon";
import { cn } from "~/lib/utils";

import { defaultCertificateColorTheme } from "./certificateTheme";

import type { CertificateColorTheme } from "./certificateTheme";

interface CertificateContentProps {
  studentName?: string;
  courseName?: string;
  completionDate?: string;
  isModal?: boolean;
  isDownload?: boolean;
  backgroundImageUrl?: string | null;
  platformLogo?: string | null;
  signatureImageUrl?: string | null;
  lang?: "pl" | "en";
  colorTheme?: CertificateColorTheme;
}

const translations = {
  pl: {
    certificate: "CERTYFIKAT",
    certifyThat: "NINIEJSZYM ZAŚWIADCZA SIĘ, ŻE",
    successfulCompletion: "ukończył/a kurs",
    confirmation: "potwierdzając tym samym realizację programu szkoleniowego.",
    date: "Data",
    signature: "Podpis",
  },
  en: {
    certificate: "CERTIFICATE",
    certifyThat: "THIS IS TO CERTIFY THAT",
    successfulCompletion: "has successfully completed the course",
    confirmation: "thereby confirming participation in the full training program.",
    date: "Date",
    signature: "Signature",
  },
};
const hrClasses = "mx-auto mb-3 w-full";
const textClasses = "text-[18px] uppercase text-gray-800";
const text2Classes = "text-[18px] text-gray-600";
const signatureClasses = "flex w-[240px] flex-col items-center";
const BASE_WIDTH = 1200;
const BASE_HEIGHT = (BASE_WIDTH * 210) / 297;

const CertificateBody = ({
  studentName,
  courseName,
  completionDate,
  backgroundImageUrl,
  platformLogo,
  signatureImageUrl,
  lang,
  colorTheme,
}: {
  studentName?: string;
  courseName?: string;
  completionDate?: string;
  backgroundImageUrl?: string | null;
  platformLogo?: string | null;
  signatureImageUrl?: string | null;
  lang: "pl" | "en";
  colorTheme: CertificateColorTheme;
}) => (
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
        {translations[lang].successfulCompletion}
      </p>
      <p className="text-[24px]" style={{ color: colorTheme.courseNameColor }}>
        &quot;{courseName}&quot;
      </p>
      <p className={text2Classes} style={{ color: colorTheme.bodyTextColor }}>
        {translations[lang].confirmation}
      </p>
    </div>

    <div className="flex items-end gap-x-52">
      <div className={signatureClasses}>
        <p className={text2Classes} style={{ color: colorTheme.bodyTextColor }}>
          {completionDate}
        </p>
        <hr className={hrClasses} style={{ borderColor: colorTheme.lineColor }} />
        <p className={textClasses} style={{ color: colorTheme.labelTextColor }}>
          {translations[lang].date}
        </p>
      </div>
      <div className={signatureClasses}>
        {signatureImageUrl && (
          <img
            src={signatureImageUrl}
            alt={translations[lang].signature}
            className="mb-2 h-12 w-full object-contain"
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

const CertificateContent = ({
  studentName,
  courseName,
  completionDate,
  isModal,
  isDownload,
  backgroundImageUrl,
  platformLogo,
  signatureImageUrl,
  lang = "en",
  colorTheme = defaultCertificateColorTheme,
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
      const nextScale = Math.min(element.clientWidth / BASE_WIDTH, 1);
      setScale(nextScale);
    };

    updateScale();

    const resizeObserver = new ResizeObserver(() => updateScale());
    resizeObserver.observe(element);

    return () => resizeObserver.disconnect();
  }, [isDownload]);

  if (isDownload) {
    return (
      <div className={cn("mx-auto h-[210mm] w-[297mm] overflow-hidden", !isModal && "rounded-lg")}>
        <CertificateBody
          studentName={studentName}
          courseName={courseName}
          completionDate={completionDate}
          backgroundImageUrl={backgroundImageUrl}
          platformLogo={platformLogo}
          signatureImageUrl={signatureImageUrl}
          lang={lang}
          colorTheme={colorTheme}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn("mx-auto w-full", !isModal && "max-w-full")}
      style={{ height: `${BASE_HEIGHT * scale}px` }}
    >
      <div
        className={cn("origin-top-left overflow-hidden", !isModal && "rounded-lg")}
        style={{
          width: `${BASE_WIDTH}px`,
          height: `${BASE_HEIGHT}px`,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <CertificateBody
          studentName={studentName}
          courseName={courseName}
          completionDate={completionDate}
          backgroundImageUrl={backgroundImageUrl}
          platformLogo={platformLogo}
          signatureImageUrl={signatureImageUrl}
          lang={lang}
          colorTheme={colorTheme}
        />
      </div>
    </div>
  );
};

export default CertificateContent;
