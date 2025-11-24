import { useParams } from "@remix-run/react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

import { useCertificates } from "~/api/queries/useCertificates";
import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { cn } from "~/lib/utils";

import { default as CertificateComponent } from "./Certificate";

interface CertificatesProps {
  onOpenCertificatePreview?: (data: {
    studentName: string;
    courseName: string;
    completionDate: string;
  }) => void;
}

const containerClasses =
  "justify-beween flex w-full max-w-[720px] flex-col gap-y-6 rounded-b-lg rounded-t-2xl bg-white p-6 drop-shadow";
const textClasses = "body-sm-md";

const Certificates = ({ onOpenCertificatePreview }: CertificatesProps) => {
  const { id = "" } = useParams();
  const { t } = useTranslation();

  const { data: certificates, isLoading, error } = useCertificates({ userId: id });
  const { data: globalSettings } = useGlobalSettings();

  if (isLoading) {
    return (
      <div className={containerClasses}>
        <h5 className="h6 md:h4">{t("studentCertificateView.header")}</h5>
        <div className="flex items-center gap-2">
          <div className="size-4 animate-spin rounded-full border-b-2 border-primary-600"></div>
          <p className={textClasses}>{t("studentCertificateView.informations.loading")}</p>
        </div>
      </div>
    );
  }

  if (error) {
    console.error("Certificates error:", error);
    return (
      <div className={containerClasses}>
        <h5 className="h5">{t("studentCertificateView.header")}</h5>
        <p className={cn(textClasses, "text-red-600")}>
          {t("studentCertificateView.informations.failedToLoad")}
        </p>
      </div>
    );
  }

  if (!certificates || certificates.length === 0) {
    return (
      <div id="certificates" className={containerClasses}>
        <h5 className="h5">{t("studentCertificateView.header")}</h5>
        <p className={cn(textClasses, "text-gray-600")}>
          {t("studentCertificateView.informations.noCertificates")}
        </p>
      </div>
    );
  }

  return (
    <div id="certificates" className={containerClasses}>
      <h5 className="h5">{t("studentCertificateView.header")}</h5>
      <div className="flex flex-col gap-4 sm:grid sm:grid-cols-3">
        {certificates.map((certificate) => {
          const completionDate = certificate.completionDate || certificate.createdAt;
          const formattedDate = completionDate
            ? format(new Date(completionDate), "dd.MM.yyyy")
            : "";

          return (
            <div key={certificate.id} className="w-full">
              <CertificateComponent
                courseName={certificate.courseTitle || ""}
                certData={certificate}
                courseCompletionDate={formattedDate}
                onOpenCertificatePreview={onOpenCertificatePreview}
                platformLogo={globalSettings?.platformLogoS3Key}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Certificates;
