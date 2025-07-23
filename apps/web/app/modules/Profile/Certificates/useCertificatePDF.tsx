import { useRef } from "react";
import * as ReactToPdf from "react-to-pdf";
import generatePDF from "react-to-pdf";

import CertificateContent from "./CertificateContent";

interface CertificateToPDFProps {
  studentName?: string;
  courseName?: string;
  completionDate?: string;
  courseId?: string;
}

const useCertificatePDF = () => {
  const targetRef = useRef<HTMLDivElement>(null);

  const downloadCertificatePdf = (courseName?: string) => {
    const options: ReactToPdf.Options = {
      filename: `${courseName ?? "certificate"}.pdf`,
      resolution: ReactToPdf.Resolution.HIGH,
      page: {
        margin: ReactToPdf.Margin.NONE,
        orientation: "landscape",
        format: "a4",
      },
      canvas: {
        qualityRatio: 2,
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
    courseId,
  }: CertificateToPDFProps) => {
    if (!studentName || !courseName || !completionDate || !courseId) {
      throw new Error("Missing required information for Certificate");
    }

    return (
      <div
        className="certificate-background"
        style={{ position: "fixed", top: 0, left: 0, opacity: 0, pointerEvents: "none" }}
      >
        <div style={{ position: "relative" }} ref={targetRef}>
          <div style={{ position: "relative", zIndex: 1 }}>
            <CertificateContent
              studentName={studentName}
              courseName={courseName}
              completionDate={completionDate}
              courseId={courseId}
            />
          </div>
        </div>
      </div>
    );
  };
  return { downloadCertificatePdf, HiddenCertificate };
};
export default useCertificatePDF;
