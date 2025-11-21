import { useState } from "react";

import CertificateContent from "./CertificateContent";
import CertificateControls from "./CertificateControls";
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
  const { HiddenCertificate, downloadCertificatePdf } = useCertificatePDF();
  const [toggled, setToggled] = useState<boolean>(false);

  const lang = toggled ? "pl" : "en";

  return (
    <>
      <HiddenCertificate
        studentName={studentName}
        courseName={courseName}
        completionDate={completionDate}
        platformLogo={platformLogo}
        lang={lang}
      />

      <div className="mx-auto w-full max-w-[95vw] overflow-hidden rounded-t-lg">
        <div className="flex items-center justify-between bg-white p-4">
          <div className="flex flex-col items-start">
            <h2 className="font-medium text-primary-800">{courseName}</h2>
            <h2 className="text-sm text-gray-400">{completionDate}</h2>
          </div>

          <CertificateControls
            onClose={onClose}
            courseName={courseName}
            languageToggled={toggled}
            setLanguageToggled={setToggled}
            downloadCertificatePdf={downloadCertificatePdf}
          />
        </div>

        <CertificateContent
          studentName={studentName}
          courseName={courseName}
          completionDate={completionDate}
          isModal
          platformLogo={platformLogo}
          backgroundImageUrl={certificateBackgroundImageUrl}
          lang={lang}
        />
      </div>
    </>
  );
};

export default CertificatePreview;
