import { useParams } from "@remix-run/react";
import { useTranslation } from "react-i18next";

import { useCertificates } from "~/api/queries/useCertificates";
import { useGlobalSettings } from "~/api/queries/useGlobalSettings";

import { default as CertificateComponent } from "./Certificate";

import type { CertificateType } from "~/types/certificate";

interface CertificatesProps {
  onOpenCertificatePreview?: (data: {
    studentName: string;
    courseName: string;
    completionDate: string;
  }) => void;
}

const Certificates = ({ onOpenCertificatePreview }: CertificatesProps) => {
  const { id = "" } = useParams();
  const { data: certificates, isLoading, error } = useCertificates({ userId: id });

  const { data: globalSettings } = useGlobalSettings();

  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="justify-beween flex w-full max-w-[720px] flex-col gap-y-6 rounded-b-lg rounded-t-2xl bg-white p-6 drop-shadow">
        <h5 className="h5">{t("studentCertificateView.header")}</h5>
        <div className="flex items-center gap-2">
          <div className="size-4 animate-spin rounded-full border-b-2 border-primary-600"></div>
          <p className="body-sm-md">{t("studentCertificateView.informations.loading")}</p>
        </div>
      </div>
    );
  }

  if (error) {
    console.error("Certificates error:", error);
    return (
      <div className="justify-beween flex w-full max-w-[720px] flex-col gap-y-6 rounded-b-lg rounded-t-2xl bg-white p-6 drop-shadow">
        <h5 className="h5">{t("studentCertificateView.header")}</h5>
        <p className="body-sm-md text-red-600">
          {t("studentCertificateView.informations.failedToLoad")}
        </p>
      </div>
    );
  }

  if (!certificates || certificates.length === 0) {
    return (
      <div className="justify-beween flex w-full max-w-[720px] flex-col gap-y-6 rounded-b-lg rounded-t-2xl bg-white p-6 drop-shadow">
        <h5 className="h5">{t("studentCertificateView.header")}</h5>
        <p className="body-sm-md text-gray-600">
          {t("studentCertificateView.informations.noCertificates")}
        </p>
      </div>
    );
  }

  return (
    <div className="justify-beween flex w-full max-w-[720px] flex-col gap-y-6 rounded-b-lg rounded-t-2xl bg-white p-6 drop-shadow">
      <h5 className="h5">{t("studentCertificateView.header")}</h5>
      <div className="flex flex-col gap-4 sm:grid sm:grid-cols-3">
        {certificates.map((certificate: CertificateType) => {
          const certData = certificate as CertificateType;
          const completionDate = certData.completionDate || certData.createdAt;
          const formattedDate = new Date(completionDate)
            .toISOString()
            .split("T")[0]
            .replaceAll("-", ".");

          return (
            <div key={certData.id} className="w-full">
              <CertificateComponent
                courseName={certData.courseTitle || ""}
                certData={certData}
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
