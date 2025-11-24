import { zodResolver } from "@hookform/resolvers/zod";
import { Navigate, useParams } from "@remix-run/react";
import { OnboardingPages } from "@repo/shared";
import { format } from "date-fns";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { useUpdateUserProfile } from "~/api/mutations";
import { useCurrentUser } from "~/api/queries";
import { useContentCreatorCourses } from "~/api/queries/useContentCreatorCourses";
import { useGlobalSettings } from "~/api/queries/useGlobalSettings";
import { useUserDetails } from "~/api/queries/useUserDetails";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { useUserRole } from "~/hooks/useUserRole";
import { copyToClipboard } from "~/utils/copyToClipboard";
import { filterChangedData } from "~/utils/filterChangedData";
import { setPageTitle } from "~/utils/setPageTitle";
import { isAdminLike } from "~/utils/userRoles";

import Loader from "../common/Loader/Loader";
import { CoursesCarousel } from "../Dashboard/Courses/CoursesCarousel";
import { useTourSetup } from "../Onboarding/hooks/useTourSetup";
import { studentProfileSteps } from "../Onboarding/routes/student";

import CertificatePreview from "./Certificates/CertificatePreview";
import Certificates from "./Certificates/Certificates";
import { ProfileActionButtons, ProfileCard, ProfileEditCard } from "./components";

import type { UpdateUserProfileBody } from "./types";
import type { MetaFunction } from "@remix-run/react";
import type { CertificateType } from "~/types/certificate";

const updateUserProfileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  description: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  jobTitle: z.string().optional(),
  userAvatar: z.instanceof(File).nullable().optional(),
});

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.profile");

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const { t } = useTranslation();
  const { id = "" } = useParams();

  const { isStudent } = useUserRole();
  const { data: userDetails, error } = useUserDetails(id);
  const { data: currentUser } = useCurrentUser();

  const { data: globalSettings } = useGlobalSettings();

  const { hasPermission, isProfileOwner } = useMemo(() => {
    return {
      hasPermission: isAdminLike(userDetails?.role ?? ""),
      isProfileOwner: currentUser?.id === userDetails?.id,
    };
  }, [userDetails, currentUser]);

  const steps = useMemo(
    () => (isStudent && isProfileOwner ? studentProfileSteps(t) : []),
    [t, isStudent, isProfileOwner],
  );

  useTourSetup({
    steps,
    isLoading: !userDetails,
    hasCompletedTour: currentUser?.onboardingStatus?.profile,
    page: OnboardingPages.PROFILE,
  });

  const { data: contentCreatorCourses } = useContentCreatorCourses(id, undefined, hasPermission);

  const toggleEditing = () => setIsEditing((prev) => !prev);

  const {
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { isDirty },
  } = useForm<UpdateUserProfileBody>({
    resolver: zodResolver(updateUserProfileSchema),
  });

  const { mutate: updateUserProfile } = useUpdateUserProfile({
    handleOnSuccess: () => {
      reset();
      toggleEditing();
    },
  });

  const onSubmit = (data: UpdateUserProfileBody) => {
    if (isDirty || data.userAvatar || data.userAvatar === null) {
      const filteredData = filterChangedData(data, userDetails as Partial<UpdateUserProfileBody>);

      if (data.userAvatar === null) {
        filteredData.userAvatar = null;
      }

      updateUserProfile({
        data: { ...filteredData },
        id,
        userAvatar: data.userAvatar || undefined,
      });
    } else {
      toggleEditing();
    }
  };

  const copyLinkToClipboard = () =>
    copyToClipboard(
      `${window.location.origin}/profile/${id}`,
      t("contentCreatorView.toast.profileLinkCopied"),
      t("contentCreatorView.toast.profileLinkCopyError"),
    );

  const [certificatePreview, setCertificatePreview] = useState<{
    isOpen: boolean;
    completionDate: string;
    certData?: CertificateType;
  }>({
    isOpen: false,
    completionDate: "",
    certData: undefined,
  });
  const formatedDate = useMemo(() => {
    const raw = certificatePreview.completionDate?.trim();
    if (!raw) return "";

    // If already formatted as dd.MM.yyyy, use as-is
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(raw)) return raw;

    const parsed = new Date(raw);
    if (!isNaN(parsed.getTime())) {
      return format(parsed, "dd.MM.yyyy");
    }

    return raw;
  }, [certificatePreview.completionDate]);

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
    <PageWrapper
      role="main"
      breadcrumbs={[
        { href: `/profile/${id}`, title: `${userDetails?.firstName} ${userDetails?.lastName}` },
      ]}
    >
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
            <CertificatePreview
              studentName={certificatePreview.certData?.fullName || ""}
              courseName={certificatePreview.certData?.courseTitle || ""}
              completionDate={formatedDate}
              onClose={handleCloseCertificatePreview}
              platformLogo={globalSettings?.platformLogoS3Key}
              certificateBackgroundImageUrl={globalSettings?.certificateBackgroundImage || null}
            />
          </div>
        </button>
      )}
      <div className="flex flex-col items-center gap-6">
        <section className="flex w-full max-w-[720px] flex-col justify-between gap-2 md:flex-row">
          <h2 className="h5 md:h3 text-neutral-950">{t("contentCreatorView.other.pageTitle")}</h2>
          <div className="flex w-full gap-4 md:w-fit">
            <ProfileActionButtons
              isEditing={isEditing}
              isProfileOwner={isProfileOwner}
              toggleEditing={toggleEditing}
              copyLinkToClipboard={copyLinkToClipboard}
              handleSubmit={handleSubmit}
              onSubmit={onSubmit}
              reset={reset}
            />
          </div>
        </section>
        {isEditing ? (
          <ProfileEditCard
            control={control}
            setValue={setValue}
            user={{
              firstName: userDetails?.firstName || "",
              lastName: userDetails?.lastName || "",
              description: userDetails?.description || "",
              jobTitle: userDetails?.jobTitle || "",
              contactEmail: userDetails?.contactEmail || "",
              contactPhone: userDetails?.contactPhone || "",
            }}
            userAvatarUrl={userDetails?.profilePictureUrl}
            isAdminLike={hasPermission}
          />
        ) : (
          <ProfileCard
            isAdminLike={hasPermission}
            userDetails={{
              ...userDetails,
            }}
          />
        )}
        {hasPermission && (
          <section className="flex w-full max-w-[720px] flex-col gap-y-6 rounded-b-lg rounded-t-2xl bg-white p-6 drop-shadow">
            <div className="flex flex-col gap-y-2">
              <h2 className="h6 md:h4">{t("contentCreatorView.other.courses")}</h2>
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
