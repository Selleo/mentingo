import { Navigate, useParams } from "@remix-run/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useContentCreatorCourses } from "~/api/queries/useContentCreatorCourses";
import { useUserDetails } from "~/api/queries/useUserDetails";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { isAdminLike } from "~/utils/userRoles";

import Loader from "../common/Loader/Loader";
import { CoursesCarousel } from "../Dashboard/Courses/CoursesCarousel";

import CertificateToPDF from "./Certificates/CertificatePreview";
import Certificates from "./Certificates/Certificates";
import { ProfileCard } from "./components";
import { ProfilePageBreadcrumbs } from "./ProfilePageBreadcrumbs";

import type { CertificateType } from "~/types/certificate";

export default function ProfilePage() {
  const { id = "" } = useParams();
  const { data: userDetails, error } = useUserDetails(id);
  const hasPermission = isAdminLike(userDetails?.role ?? "");
  const { data: contentCreatorCourses } = useContentCreatorCourses(id, undefined, hasPermission);
  const { t } = useTranslation();

  const [certificatePreview, setCertificatePreview] = useState<{
    isOpen: boolean;
    completionDate: string;
    certData?: CertificateType;
  }>({
    isOpen: false,
    completionDate: "",
    certData: undefined,
  });

  const handleOpenCertificatePreview = (data: {
    completionDate: string;
    certData?: CertificateType;
  }) => {
    setCertificatePreview({
      isOpen: true,
      ...data,
    });
  };

  const handleCloseCertificatePreview = () => {
    setCertificatePreview((prev) => ({
      ...prev,
      isOpen: false,
    }));
  };

  if (error) return <Navigate to="/" />;

  if (!userDetails)
    return (
      <div className="grid h-full w-full place-items-center">
        <Loader />
      </div>
    );

  return (
    <PageWrapper role="main">
      {certificatePreview.isOpen && (
        <button
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50"
          onClick={handleCloseCertificatePreview}
          onKeyDown={(e) => {
            if (e.key === "Escape" || e.key === "Enter") {
              handleCloseCertificatePreview();
            }
          }}
        >
          <div>
            <CertificateToPDF
              studentName={certificatePreview.certData?.fullName || ""}
              courseName={certificatePreview.certData?.courseTitle || ""}
              completionDate={certificatePreview.completionDate}
              onClose={handleCloseCertificatePreview}
            />
          </div>
        </button>
      )}
      <ProfilePageBreadcrumbs
        id={id}
        username={`${userDetails?.firstName} ${userDetails?.lastName}`}
      />
      <div className="flex flex-col items-center gap-6">
        <section className="flex w-full max-w-[720px] justify-between">
          <h2 className="h5 md:h3 text-neutral-950">{t("contentCreatorView.other.pageTitle")}</h2>
        </section>
        <ProfileCard isAdminLike={hasPermission} userDetails={userDetails} />
        {hasPermission && (
          <section className="flex w-full max-w-[720px] flex-col gap-y-6 rounded-b-lg rounded-t-2xl bg-white p-6 drop-shadow">
            <div className="flex flex-col gap-y-2">
              <h2 className="h5 md:h3">{t("contentCreatorView.other.courses")}</h2>
            </div>
            <CoursesCarousel
              courses={contentCreatorCourses}
              buttonContainerClasses="right-0 lg:-top-16"
            />
            <Button variant="outline" className="sr-only">
              {t("contentCreatorView.button.showMore")}
            </Button>
          </section>
        )}
        <Certificates onOpenCertificatePreview={handleOpenCertificatePreview} />
      </div>
    </PageWrapper>
  );
}
