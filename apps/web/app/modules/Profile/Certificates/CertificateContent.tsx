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
  hasBottomMargin?: boolean;
}

const CertificateContent = ({
  studentName,
  courseName,
  completionDate,
  hasBottomMargin,
}: CertificateContentProps) => {
  return (
    <div
      className={`${
        hasBottomMargin ? "mb-24" : ""
      } flex max-h-[76vh] min-w-[110vb] flex-col items-center gap-4 overflow-hidden bg-white px-32 py-12`}
    >
      <div className="flex flex-col items-center gap-2">
        <AppLogo className="h-24" />
        <h1 className="text-center text-6xl font-bold">CERTIFICATE</h1>
        <p className="text-xl font-bold">OF ACHIEVEMENT</p>
      </div>

      <CertificateText className="h-12" />
      <div>
        <h2 className="text-center text-3xl font-medium">{studentName}</h2>
        <div className="flex flex-col items-center gap-1">
          <p className="text-center text-lg text-gray-600">
            Certificate for completion and great results in the course:
          </p>
        </div>
        <h3 className="text-center text-xl font-light">&quot;{courseName}&quot;</h3>
      </div>
      <div className="flex w-full items-center justify-center gap-16">
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
