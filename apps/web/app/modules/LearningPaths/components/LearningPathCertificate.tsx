import { format } from "date-fns";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCurrentUser } from "~/api/queries";
import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { useLearningPathCertificate } from "~/api/queries/useLearningPathCertificate";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { CERTIFICATE_KIND } from "~/modules/Profile/Certificates/certificateKind";
import CertificatePreview from "~/modules/Profile/Certificates/CertificatePreview";

type LearningPathCertificateProps = {
  learningPathId: string;
  title: string;
  certificateReady: boolean;
  className?: string;
};

export function LearningPathCertificate({
  learningPathId,
  title,
  certificateReady,
  className,
}: LearningPathCertificateProps) {
  const { t } = useTranslation();
  const { language } = useLanguageStore();
  const { data: currentUser } = useCurrentUser();
  const { data: globalSettings } = useGlobalSettings();

  const [isCertificatePreviewOpen, setCertificatePreviewOpen] = useState(false);

  const { data: certificate } = useLearningPathCertificate({
    userId: currentUser?.id,
    learningPathId,
    language,
  });

  const certificateInfo = useMemo(() => {
    if (!currentUser) return { studentName: "", pathName: "", formattedDate: "" };

    const studentName = certificate?.fullName || `${currentUser.firstName} ${currentUser.lastName}`;
    const pathName = certificate?.courseTitle || title;
    const completionDate = certificate ? certificate.completionDate : null;
    const formattedDate = completionDate ? format(new Date(completionDate), "dd.MM.yyyy") : "";

    return { studentName, pathName, formattedDate };
  }, [certificate, currentUser, title]);

  if (!certificate || !certificateReady) return null;

  const { studentName, pathName, formattedDate } = certificateInfo;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border border-success-200 bg-success-50 p-3 md:px-4",
          className,
        )}
      >
        <div className="grid aspect-square size-8 place-items-center rounded-full bg-success-50">
          <Icon name="InputRoundedMarkerSuccess" className="size-4" />
        </div>
        <p className="body-sm-md grow">{t("learningPathsView.certificate.pathCompleted")}</p>
        <div>
          <Button variant="ghost" size="sm" onClick={() => setCertificatePreviewOpen(true)}>
            <Icon name="Eye" className="mr-2 size-4" />
            {t("studentCourseView.certificate.button.viewCertificate")}
          </Button>
        </div>
      </div>

      {isCertificatePreviewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50"
          onClick={() => setCertificatePreviewOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape" || event.key === "Enter") {
              setCertificatePreviewOpen(false);
            }
          }}
          role="button"
          tabIndex={0}
        >
          <div role="presentation" onClick={(event) => event.stopPropagation()}>
            <CertificatePreview
              certificateId={certificate.id}
              studentName={studentName}
              courseName={pathName}
              completionDate={formattedDate}
              onClose={() => setCertificatePreviewOpen(false)}
              platformLogo={globalSettings?.platformLogoS3Key}
              certificateBackgroundImageUrl={globalSettings?.certificateBackgroundImage}
              certificateSignatureUrl={certificate.certificateSignatureUrl}
              initialColor={certificate.certificateFontColor}
              showShareButton={Boolean(certificate.id)}
              certificateKind={CERTIFICATE_KIND.LEARNING_PATH}
            />
          </div>
        </div>
      )}
    </div>
  );
}
