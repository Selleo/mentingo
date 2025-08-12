import { useRef } from "react";
import * as ReactToPdf from "react-to-pdf";
import generatePDF from "react-to-pdf";

import CertificateContent from "./CertificateContent";

interface CertificateToPDFProps {
  studentName?: string;
  courseName?: string;
  completionDate?: string;
  platformLogo?: string | null;
  backgroundImageUrl?: string | null;
}

const useCertificatePDF = () => {
  const targetRef = useRef<HTMLDivElement>(null);

  const downloadCertificatePdf = (courseName?: string) => {
    const options: ReactToPdf.Options = {
      filename: `${courseName ?? "certificate"}.pdf`,
      resolution: ReactToPdf.Resolution.MEDIUM,
      page: {
        margin: ReactToPdf.Margin.NONE,
        orientation: "landscape",
        format: "a4",
      },
      canvas: {
        qualityRatio: 1,
        useCORS: true,
      },
    };

    if (targetRef.current) {
      generatePDF(targetRef, options);
    } else {
      console.error("Couln't generate PDF: no targetRef found");
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
      <div ref={targetRef} style={{ width: "297mm", height: "210mm" }}>
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
