import { useCertificateBackground } from "~/api/queries/admin/useCertificateBackground";
import {
  AppLogo,
  Award,
  certificateText as CertificateText,
  hrLinePdf as HrLinePdf,
} from "~/assets/svgs";

interface CertificateContentProps {
  studentName?: string;
  courseName?: string;
  completionDate?: string;
  courseId?: string;
  hasBottomMargin?: boolean;
}

const CertificateContent = ({
  studentName,
  courseName,
  completionDate,
  courseId,
  hasBottomMargin,
}: CertificateContentProps) => {
  if (!studentName || !courseName || !completionDate || !courseId) {
    throw new Error("Missing required informations for Certificate");
  }
  const { data: certificateBackground } = useCertificateBackground(courseId);

  return (
    <div
      className={`relative ${hasBottomMargin ? "mb-24" : ""} flex max-h-[76vh] min-w-[110vb] flex-col items-center gap-4 overflow-hidden bg-white px-32 py-12`}
    >
      {certificateBackground?.data.url && (
        <img
          src={certificateBackground.data.url}
          alt="Certificate Background"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            zIndex: 0,
          }}
        />
      )}
      <div className="flex flex-col items-center gap-2" style={{ position: "relative", zIndex: 1 }}>
        <AppLogo className="h-24" />
        <h1 className="text-center text-6xl font-bold">CERTIFICATE</h1>
        <p className="text-xl font-bold">OF ACHIEVEMENT</p>
      </div>

      <CertificateText className="h-12" style={{ position: "relative", zIndex: 1 }} />
      <div style={{ position: "relative", zIndex: 1 }}>
        <h2 className="text-center text-3xl font-medium">{studentName}</h2>
        <div className="flex flex-col items-center gap-1">
          <p className="text-center text-lg text-gray-600">
            Certificate for completion and great results in the course:
          </p>
        </div>
        <h3 className="text-center text-xl font-light">&quot;{courseName}&quot;</h3>
      </div>
      <div
        className="flex w-full items-center justify-center gap-16"
        style={{ position: "relative", zIndex: 1 }}
      >
        <div className="flex flex-col items-center justify-center text-center">
          <p className="pb-2 text-base text-gray-500">{completionDate}</p>
          <HrLinePdf className="h-1" />
          <p className="pt-2 text-base">DATE</p>
        </div>
        <Award className="size-24" />
        <div className="flex flex-col items-center justify-center text-center">
          <p className="select-none text-base text-gray-500 text-transparent">-</p>
          <HrLinePdf className="h-1" />
          <p className="pt-2 text-base">SIGNATURE</p>
        </div>
      </div>
    </div>
  );
};

export default CertificateContent;
