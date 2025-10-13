import { X, Download } from "lucide-react";

import CertificateContent from "./CertificateContent";
import useCertificatePDF from "./useCertificatePDF";

interface CertificatePreviewProps {
  studentName?: string;
  courseName?: string;
  completionDate?: string;
  onClose?: () => void;
  platformLogo?: string | null;
  certificateBackgroundImageUrl?: string | null;
}

const CertificatePreview = ({
  studentName,
  courseName,
  completionDate,
  onClose,
  platformLogo,
  certificateBackgroundImageUrl,
}: CertificatePreviewProps) => {
  const { downloadCertificatePdf, HiddenCertificate } = useCertificatePDF();

  const handleDownload = () => {
    downloadCertificatePdf(courseName);
  };
  return (
    <>
      <HiddenCertificate
        studentName={studentName}
        courseName={courseName}
        completionDate={completionDate}
        platformLogo={platformLogo}
      />

      <div className="mx-auto w-full max-w-[95vw] overflow-hidden rounded-t-lg">
        <div className="flex items-center justify-between bg-white p-4">
          <div className="flex flex-col items-start">
            <h2 className="font-medium text-primary-800">{courseName}</h2>
            <h2 className="text-sm text-gray-400">{completionDate}</h2>
          </div>

          <div className="flex gap-3">
            <button
              className="flex size-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
              onClick={handleDownload}
            >
              <Download className="size-5" />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="flex size-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="size-5" />
              </button>
            )}
          </div>
        </div>

        <CertificateContent
          studentName={studentName}
          courseName={courseName}
          completionDate={completionDate}
          isModal
          platformLogo={platformLogo}
          backgroundImageUrl={certificateBackgroundImageUrl}
        />
      </div>
    </>
  );
};

export default CertificatePreview;
