import { zodResolver } from "@hookform/resolvers/zod";
import { Navigate, useParams } from "@remix-run/react";
import { OnboardingPages, PERMISSIONS } from "@repo/shared";
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
import { usePermissions } from "~/hooks/usePermissions";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { copyToClipboard } from "~/utils/copyToClipboard";
import { filterChangedData } from "~/utils/filterChangedData";
import { setPageTitle } from "~/utils/setPageTitle";

import { LOGIN_REDIRECT_URL } from "../Auth/constants";
import Loader from "../common/Loader/Loader";
import { CoursesCarousel } from "../Dashboard/Courses/CoursesCarousel";
import { useTourSetup } from "../Onboarding/hooks/useTourSetup";
import { studentProfileSteps } from "../Onboarding/routes/student";

import CertificatePreview from "./Certificates/CertificatePreview";
import Certificates from "./Certificates/Certificates";
import { ProfileActionButtons, ProfileCard, ProfileEditCard } from "./components";

import type { UpdateUserProfileBody } from "./types";
import type { MetaFunction } from "@remix-run/react";
import type { CurrentUserResponse } from "~/api/generated-api";
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
  const { data: currentUser } = useCurrentUser();

  if (currentUser?.isSupportMode) return <Navigate to={LOGIN_REDIRECT_URL} replace />;

  return <ProfilePageContent currentUser={currentUser} />;
}

type ProfilePageContentProps = {
  currentUser?: CurrentUserResponse["data"];
};

function ProfilePageContent({ currentUser }: ProfilePageContentProps) {
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const { t } = useTranslation();
  const { id = "" } = useParams();

  const { language } = useLanguageStore();

  const { hasAccess: canUpdateLearningProgress } = usePermissions({
    required: PERMISSIONS.LEARNING_PROGRESS_UPDATE,
  });
  const { hasAccess: canManageCourses } = usePermissions({
    required: [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
  });
  const { data: userDetails, error } = useUserDetails(id);

  const { data: globalSettings } = useGlobalSettings();

  const { canViewExtendedProfile, isProfileOwner } = useMemo(() => {
    return {
      canViewExtendedProfile: canManageCourses,
      isProfileOwner: currentUser?.id === userDetails?.id,
    };
  }, [currentUser, canManageCourses, userDetails]);

  const steps = useMemo(
    () => (canUpdateLearningProgress && isProfileOwner ? studentProfileSteps(t) : []),
    [t, canUpdateLearningProgress, isProfileOwner],
  );

  useTourSetup({
    steps,
    isLoading: !userDetails,
    hasCompletedTour: currentUser?.onboardingStatus?.profile,
    page: OnboardingPages.PROFILE,
  });

  const { data: contentCreatorCourses } = useContentCreatorCourses(
    id,
    { language },
    canViewExtendedProfile,
  );

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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50"
          onClick={handleCloseCertificatePreview}
          onKeyDown={(e) => {
            if (e.key === "Escape" || e.key === "Enter") {
              handleCloseCertificatePreview();
            }
          }}
          role="button"
          tabIndex={0}
        >
          <div role="presentation" onClick={(event) => event.stopPropagation()}>
            <CertificatePreview
              certificateId={certificatePreview.certData?.id}
              studentName={certificatePreview.certData?.fullName || ""}
              courseName={certificatePreview.certData?.courseTitle || ""}
              completionDate={formatedDate}
              onClose={handleCloseCertificatePreview}
              platformLogo={globalSettings?.platformLogoS3Key}
              certificateBackgroundImageUrl={globalSettings?.certificateBackgroundImage || null}
              certificateSignatureUrl={certificatePreview.certData?.certificateSignatureUrl || null}
              initialColor={certificatePreview.certData?.certificateFontColor || null}
              showDownloadButton={isProfileOwner}
              showShareButton={Boolean(certificatePreview.certData?.id)}
            />
          </div>
        </div>
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
            canManageCourses={canViewExtendedProfile}
          />
        ) : (
          <ProfileCard
            canManageCourses={canViewExtendedProfile}
            userDetails={{
              ...userDetails,
            }}
          />
        )}
        {canViewExtendedProfile && (
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
