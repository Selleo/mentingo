import { X, Download } from "lucide-react";

import CertificateContent from "./CertificateContent";
import useCertificatePDF from "./useCertificatePDF";

interface CertificatePreviewProps {
  studentName?: string;
  courseName?: string;
  completionDate?: string;
  onClose?: () => void;
}

const CertificatePreview = ({
  studentName,
  courseName,
  completionDate,
  onClose,
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
      />

      <div className="m-4 w-full rounded-t-lg bg-white">
        <div className="flex items-center justify-between p-4">
          <div>
            <h2 className="font-medium text-blue-800">{courseName}</h2>
            <h2 className="text-sm text-gray-400">{completionDate}</h2>
          </div>

          <div className="flex gap-3">
            <button
              className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
              onClick={handleDownload}
            >
              <Download className="size-5" />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
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
          hasBottomMargin={true}
        />
      </div>
    </>
  );
};

export default CertificatePreview;
