import { Eye, Download } from "lucide-react";
import { useState } from "react";

import { CertificateTrophy } from "~/assets/svgs";

import useCertificatePDF from "./useCertificatePDF";

import type { CertificateType } from "~/api/queries/useCertificates";

interface CertificateProps {
  courseName: string;
  courseCompletionDate: string;
  certData?: CertificateType;
  onOpenCertificatePreview?: (data: {
    studentName: string;
    courseName: string;
    completionDate: string;
    certData?: CertificateType;
  }) => void;
}

interface OptionsProps {
  handlePreviewClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  handleDownloadClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

const Options = ({ handlePreviewClick, handleDownloadClick }: OptionsProps) => {
  return (
    <div className="absolute right-5 top-5 z-10 w-60 rounded-md border bg-white shadow-xl">
      <ul className="py-1">
        <button onClick={handlePreviewClick} className="w-full">
          <li className="flex cursor-pointer items-center gap-3 px-4 py-2 hover:bg-gray-100">
            <Eye className="size-6 text-blue-800" /> Preview
          </li>
        </button>
        <button onClick={handleDownloadClick} className="w-full">
          <li className="flex cursor-pointer items-center gap-3 px-4 py-2 hover:bg-gray-100">
            <Download className="size-6 text-blue-800" /> Download
          </li>
        </button>
      </ul>
    </div>
  );
};

const Certificate = ({
  courseName,
  courseCompletionDate,
  certData,
  onOpenCertificatePreview,
}: CertificateProps) => {
  const [showOptions, setShowOptions] = useState(false);

  const { downloadCertificatePdf, HiddenCertificate } = useCertificatePDF();

  const handleDownloadClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (certData) {
      downloadCertificatePdf(courseName);
    }
    setShowOptions(false);
  };

  const handleOptionsCLick = () => {
    setShowOptions(!showOptions);
  };

  const handlePreviewClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (onOpenCertificatePreview) {
      onOpenCertificatePreview({
        studentName: certData?.fullName || "Student Name",
        courseName: certData?.courseTitle || courseName,
        completionDate: courseCompletionDate,
        certData: certData,
      });
    }
    setShowOptions(false);
  };

  const displayCourseName =
    courseName.split(" ").length > 3
      ? courseName.split(" ").slice(0, 3).join(" ") + "..."
      : courseName;

  return (
    <>
      <HiddenCertificate
        studentName={certData?.fullName || ""}
        courseName={certData?.courseTitle || courseName}
        completionDate={courseCompletionDate}
      />
      <div className="grid grid-cols-1 gap-4">
        <div className="relative">
          <div className="absolute -right-3 -top-3 size-9 rounded-lg border-2 border-gray-300 bg-white">
            {showOptions && (
              <Options
                handlePreviewClick={handlePreviewClick}
                handleDownloadClick={handleDownloadClick}
              />
            )}
            <button
              onClick={() => handleOptionsCLick()}
              className="text-1xl absolute inset-0 flex rotate-90 items-center justify-center"
            >
              ⋯
            </button>
          </div>
          <div className="border-black/60 flex max-h-24 items-center gap-2 rounded-2xl border-2 p-3">
            <CertificateTrophy className="min-h-12 min-w-12" />
            <div className="flex flex-col pl-2">
              <h3 className="body-sm-md font-semibold">{displayCourseName}</h3>
              <h4 className="details">{courseCompletionDate}</h4>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Certificate;
