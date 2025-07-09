import { useParams } from "@remix-run/react";

import { useCertificates } from "~/api/queries/useCertificates";

import Certificate from "./Certificate";

interface CertificateData {
  id: string;
  courseTitle?: string | null;
  completionDate?: string;
  createdAt: string;
}

const Certificates = () => {
  const { id = "" } = useParams();
  const { data: certificates, isLoading, error } = useCertificates({ userId: id });

  if (isLoading) {
    return (
      <div className="justify-beween flex w-full max-w-[720px] flex-col gap-y-6 rounded-b-lg rounded-t-2xl bg-white p-6 drop-shadow">
        <h5 className="h5">Certificates</h5>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-primary-600"></div>
          <p className="body-sm-md">Loading certificates...</p>
        </div>
      </div>
    );
  }

  if (error) {
    console.error("Certificates error:", error);
    return (
      <div className="justify-beween flex w-full max-w-[720px] flex-col gap-y-6 rounded-b-lg rounded-t-2xl bg-white p-6 drop-shadow">
        <h5 className="h5">Certificates</h5>
        <p className="body-sm-md text-red-600">
          Failed to load certificates. Please try again later.
        </p>
      </div>
    );
  }

  if (!certificates || certificates.length === 0) {
    return (
      <div className="justify-beween flex w-full max-w-[720px] flex-col gap-y-6 rounded-b-lg rounded-t-2xl bg-white p-6 drop-shadow">
        <h5 className="h5">Certificates</h5>
        <p className="body-sm-md text-gray-600">
          No certificates available yet. Complete a course to earn your first certificate!
        </p>
      </div>
    );
  }

  return (
    <div className="justify-beween flex w-full max-w-[720px] flex-col gap-y-6 rounded-b-lg rounded-t-2xl bg-white p-6 drop-shadow">
      <h5 className="h5">Certificates</h5>
      <div className="flex flex-wrap gap-4">
        {certificates.map((certificate) => {
          const cert = certificate as CertificateData;
          const completionDate = cert.completionDate || cert.createdAt;
          const formattedDate = new Date(completionDate).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          });

          return (
            <Certificate
              key={cert.id}
              courseName={cert.courseTitle || "Unknown Course"}
              courseCompletionDate={formattedDate}
            />
          );
        })}
      </div>
    </div>
  );
};

export default Certificates;
