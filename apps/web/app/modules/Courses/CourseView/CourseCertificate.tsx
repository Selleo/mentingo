import { useParams } from "@remix-run/react";
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

const CourseCertificate = () => {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const { language } = useLanguageStore();

  const { data: course } = useCourse(id, language);
  const { isStudent } = useUserRole();
  const { data: currentUser } = useCurrentUser();
  const { data: globalSettings } = useGlobalSettings();

  const [isCertificatePreviewOpen, setCertificatePreview] = useState(false);

  const { data: certificate } = useCertificate({
    userId: currentUser?.id,
    courseId: id,
    language,
  });

  const hasFinishedCourse = useMemo(() => {
    return course?.completedChapterCount === course?.courseChapterCount;
  }, [course?.completedChapterCount, course?.courseChapterCount]);

  const certificateInfo = useMemo(() => {
    if (!course || !currentUser || !isStudent) {
      return { studentName: "", courseName: "", formattedDate: "" };
    }

    const cert = certificate?.[0];

    const studentName = cert?.fullName || `${currentUser.firstName} ${currentUser.lastName}`;
    const courseName = cert?.courseTitle || course.title;
    const completionDate = cert ? cert.completionDate : null;
    const formattedDate = completionDate ? format(new Date(completionDate), "dd.MM.yyyy") : "";

    return { studentName, courseName, formattedDate };
  }, [certificate, currentUser, course, isStudent]);

  const { studentName, courseName, formattedDate } = certificateInfo;

  const handleOpenCertificatePreview = () => setCertificatePreview(true);
  const handleCloseCertificatePreview = () => setCertificatePreview(false);

  return (
    <div>
      {certificate && hasFinishedCourse && (
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

      {certificate && isCertificatePreviewOpen && isStudent && (
        <button
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50"
          onClick={handleCloseCertificatePreview}
        >
          <div>
            <CertificatePreview
              studentName={studentName}
              courseName={courseName}
              completionDate={formattedDate}
              onClose={handleCloseCertificatePreview}
              platformLogo={globalSettings?.platformLogoS3Key}
              certificateBackgroundImageUrl={globalSettings?.certificateBackgroundImage}
            />
          </div>
        </button>
      )}
    </div>
  );
};

export default CourseCertificate;
