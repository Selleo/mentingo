import { CertificateTrophy } from "~/assets/svgs";

interface CertificateProps {
  courseName: string;
  courseCompletionDate: string;
}

const Certificate = ({ courseName, courseCompletionDate }: CertificateProps) => {
  courseName =
    courseName.split(" ").length > 3
      ? courseName.split(" ").slice(0, 3).join(" ") + "..."
      : courseName;
  return (
    <div className="flex-1">
      <div className="border-black/60 flex max-h-24 items-center gap-2 rounded-2xl border-2 p-3">
        <CertificateTrophy className="min-h-12 min-w-12" />
        <div className="flex flex-col pl-2">
          <h3 className="body-sm-md font-semibold">{courseName}</h3>
          <h4 className="details">{courseCompletionDate}</h4>
        </div>
      </div>
    </div>
  );
};

export default Certificate;
