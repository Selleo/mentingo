import { CertificateTrophy } from "~/assets/svgs";
import { Button } from "~/components/ui/button";

import useCertificatePDF from "./useCertificatePDF";

import type { CertificateType } from "~/types/certificate";
interface CertificateProps {
  courseName: string;
  courseCompletionDate: string;
  certData?: CertificateType;
  platformLogo?: string | null;
  backgroundImageUrl?: string | null;
  onOpenCertificatePreview?: (data: {
    studentName: string;
    courseName: string;
    completionDate: string;
    certData?: CertificateType;
  }) => void;
}

const Certificate = ({
  courseName,
  courseCompletionDate,
  certData,
  platformLogo,
  backgroundImageUrl,
  onOpenCertificatePreview,
}: CertificateProps) => {
  const { HiddenCertificate } = useCertificatePDF();

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
  };

  return (
    <>
      <HiddenCertificate
        studentName={certData?.fullName || ""}
        courseName={certData?.courseTitle || courseName}
        completionDate={courseCompletionDate}
        platformLogo={platformLogo}
        lang="en"
        backgroundImageUrl={backgroundImageUrl}
      />
      <div className="grid grid-cols-1 gap-4">
        <div className="relative">
          <Button
            variant="outline"
            className="border-black/60 flex min-h-24 text-neutral text-left max-w-56 items-center gap-2 rounded-2xl border-2 p-3"
            onClick={handlePreviewClick}
          >
            <CertificateTrophy className="min-h-10 min-w-10" />
            <div className="flex flex-col pl-2 overflow-x-hidden">
              <h3 className="body-sm-md font-semibold truncate">{courseName}</h3>
              <h4 className="details">{courseCompletionDate}</h4>
            </div>
          </Button>
        </div>
      </div>
    </>
  );
};

export default Certificate;
