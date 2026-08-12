import { useMemo, useState } from "react";

import { useCourse, useCurrentUser } from "~/api/queries";
import { useCertificate } from "~/api/queries/useCertificates";
import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { useCourseAccessProvider } from "~/modules/Courses/context/CourseAccessProvider";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import CertificatePreview from "~/modules/Profile/Certificates/CertificatePreview";
import { formatCertificateDate } from "~/utils/formatCertificateDate";

import CertificateStatCard from "./CourseStatBar/CertificateStatCard";

type CourseCertificateProps = {
  courseId: string;
};

const CourseCertificate = ({ courseId }: CourseCertificateProps) => {
  const { language } = useLanguageStore();

  const { data: course } = useCourse(courseId, language);
  const { data: currentUser } = useCurrentUser();
  const { data: globalSettings } = useGlobalSettings();
  const { isEffectiveStudentExperience } = useCourseAccessProvider();

  const [isCertificatePreviewOpen, setCertificatePreview] = useState(false);

  const { data: certificate } = useCertificate({
    userId: currentUser?.id,
    courseId,
    language,
  });

  const hasFinishedCourse = useMemo(() => {
    return course?.completedChapterCount === course?.courseChapterCount;
  }, [course?.completedChapterCount, course?.courseChapterCount]);
  const isCertificateAvailable = Boolean(
    certificate && hasFinishedCourse && isEffectiveStudentExperience,
  );

  const certificateInfo = useMemo(() => {
    if (!course || !currentUser || !isEffectiveStudentExperience) {
      return { studentName: "", courseName: "", formattedDate: "", formattedExpiryDate: "" };
    }

    const studentName = certificate?.fullName || `${currentUser.firstName} ${currentUser.lastName}`;
    const courseName = certificate?.courseTitle || course.title;
    const completionDate = certificate ? certificate.completionDate : null;
    const formattedDate = formatCertificateDate(completionDate);
    const formattedExpiryDate = formatCertificateDate(certificate?.expiresAt);

    return { studentName, courseName, formattedDate, formattedExpiryDate };
  }, [certificate, currentUser, course, isEffectiveStudentExperience]);

  const { studentName, courseName, formattedDate, formattedExpiryDate } = certificateInfo;

  const handleOpenCertificatePreview = () => setCertificatePreview(true);
  const handleCloseCertificatePreview = () => setCertificatePreview(false);

  if (!course?.hasCertificate || !isEffectiveStudentExperience) return null;

  return (
    <>
      <CertificateStatCard
        availableLabel={isCertificateAvailable ? formattedDate : undefined}
        hasCertificate
        isAdminExperience={false}
        isCertificateAvailable={isCertificateAvailable}
        onOpen={handleOpenCertificatePreview}
      />

      {isCertificatePreviewOpen && (
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
              certificateId={certificate?.id}
              studentName={studentName}
              courseName={courseName}
              completionDate={formattedDate}
              expiryDate={formattedExpiryDate || undefined}
              onClose={handleCloseCertificatePreview}
              platformLogo={globalSettings?.platformLogoS3Key}
              certificateBackgroundImageUrl={globalSettings?.certificateBackgroundImage}
              certificateSignatureUrl={certificate?.certificateSignatureUrl}
              initialColor={certificate?.certificateFontColor}
              showShareButton={Boolean(certificate?.id)}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default CourseCertificate;
