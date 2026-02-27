import { format } from "date-fns";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCourse, useCurrentUser } from "~/api/queries";
import { useCertificate } from "~/api/queries/useCertificates";
import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { useUserRole } from "~/hooks/useUserRole";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import CertificatePreview from "~/modules/Profile/Certificates/CertificatePreview";

const CourseCertificate = ({ courseId }: { courseId: string }) => {
  const { t } = useTranslation();
  const { language } = useLanguageStore();

  const { data: course } = useCourse(courseId, language);
  const { isStudent } = useUserRole();
  const { data: currentUser } = useCurrentUser();
  const { data: globalSettings } = useGlobalSettings();

  const [isCertificatePreviewOpen, setCertificatePreview] = useState(false);

  const { data: certificate } = useCertificate({
    userId: currentUser?.id,
    courseId,
    language,
  });
  const certificateRecord = certificate;

  const hasFinishedCourse = useMemo(() => {
    return course?.completedChapterCount === course?.courseChapterCount;
  }, [course?.completedChapterCount, course?.courseChapterCount]);

  const certificateInfo = useMemo(() => {
    if (!course || !currentUser || !isStudent) {
      return { studentName: "", courseName: "", formattedDate: "" };
    }

    const studentName =
      certificateRecord?.fullName || `${currentUser.firstName} ${currentUser.lastName}`;
    const courseName = certificateRecord?.courseTitle || course.title;
    const completionDate = certificateRecord ? certificateRecord.completionDate : null;
    const formattedDate = completionDate ? format(new Date(completionDate), "dd.MM.yyyy") : "";

    return { studentName, courseName, formattedDate };
  }, [certificateRecord, currentUser, course, isStudent]);

  const { studentName, courseName, formattedDate } = certificateInfo;

  const handleOpenCertificatePreview = () => setCertificatePreview(true);
  const handleCloseCertificatePreview = () => setCertificatePreview(false);

  return (
    <div>
      {Boolean(certificateRecord) && hasFinishedCourse && (
        <Card className="p-4 md:px-8 flex items-center gap-4 bg-success-50">
          <div className="bg-success-50 aspect-square size-10 rounded-full grid place-items-center">
            <Icon name="InputRoundedMarkerSuccess" className="size-4" />
          </div>
          <p className="body-sm-md grow">{t("studentCourseView.certificate.courseCompleted")}</p>
          <div>
            <Button variant="ghost" size="sm" onClick={handleOpenCertificatePreview}>
              <Icon name="Eye" className="size-4 mr-2" />
              {t("studentCourseView.certificate.button.viewCertificate")}
            </Button>
          </div>
        </Card>
      )}

      {Boolean(certificateRecord) && isCertificatePreviewOpen && isStudent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50"
          onClick={handleCloseCertificatePreview}
          onKeyDown={(event) => {
            if (event.key === "Escape" || event.key === "Enter") handleCloseCertificatePreview();
          }}
          role="button"
          tabIndex={0}
        >
          <div role="presentation" onClick={(event) => event.stopPropagation()}>
            <CertificatePreview
              studentName={studentName}
              courseName={courseName}
              completionDate={formattedDate}
              onClose={handleCloseCertificatePreview}
              platformLogo={globalSettings?.platformLogoS3Key}
              certificateBackgroundImageUrl={globalSettings?.certificateBackgroundImage}
              certificateSignatureUrl={certificateRecord?.certificateSignatureUrl}
              initialColor={certificateRecord?.certificateFontColor}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseCertificate;
