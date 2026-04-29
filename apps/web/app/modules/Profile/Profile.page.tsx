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
import { useProfileAchievements } from "~/api/queries/useProfileAchievements";
import { useUserDetails } from "~/api/queries/useUserDetails";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
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
import type { ProfileAchievement } from "~/api/queries/useProfileAchievements";
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

type ProfileAchievementsGridProps = {
  achievements: ProfileAchievement[];
};

function ProfileAchievementsGrid({ achievements }: ProfileAchievementsGridProps) {
  const { t } = useTranslation();

  if (achievements.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {achievements.map((achievement) => {
        const isUnlocked = Boolean(achievement.unlockedAt);
        const unlockedDate = achievement.unlockedAt
          ? format(new Date(achievement.unlockedAt), "dd.MM.yyyy")
          : null;

        return (
          <TooltipProvider key={achievement.id} delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <article className="flex gap-x-3 rounded-lg border border-neutral-100 p-3">
                  <img
                    src={achievement.imageUrl}
                    alt={achievement.localizedName}
                    className={`h-14 w-14 rounded-md object-cover ${isUnlocked ? "" : "grayscale"}`}
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-y-1">
                    <div className="flex items-start justify-between gap-x-2">
                      <h3 className="body-2 truncate font-semibold text-neutral-950">
                        {achievement.localizedName}
                      </h3>
                      <span className="caption whitespace-nowrap text-neutral-500">
                        {achievement.pointThreshold} {t("contentCreatorView.other.points")}
                      </span>
                    </div>
                    <p className="caption line-clamp-2 text-neutral-500">
                      {achievement.localizedDescription}
                    </p>
                    {!isUnlocked && (
                      <div className="mt-1 flex flex-col gap-y-1">
                        <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                          <div
                            className="h-full rounded-full bg-primary-600"
                            style={{ width: `${achievement.progress.percentage}%` }}
                          />
                        </div>
                        <span className="caption text-neutral-500">
                          {t("contentCreatorView.other.achievementProgress", {
                            current: achievement.progress.currentTotal,
                            threshold: achievement.progress.threshold,
                            remaining: achievement.progress.pointsRemaining,
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </article>
              </TooltipTrigger>
              {isUnlocked && unlockedDate && (
                <TooltipContent>
                  {t("contentCreatorView.other.achievementUnlockedAt", { date: unlockedDate })}
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
}

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

  const { data: profileAchievements } = useProfileAchievements(language, Boolean(isProfileOwner));

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
        {isProfileOwner && (
          <section className="flex w-full max-w-[720px] flex-col gap-y-5 rounded-b-lg rounded-t-2xl bg-white p-6 drop-shadow">
            <div className="flex flex-col gap-y-3">
              <p className="body-2 text-neutral-500">
                {t("contentCreatorView.other.gamification")}
              </p>
              <div className="flex items-end gap-x-2">
                <strong className="h3 text-primary-700">
                  {profileAchievements?.totalPoints ?? currentUser?.gamification.totalPoints ?? 0}
                </strong>
                <span className="body-2 pb-1 text-neutral-700">
                  {t("contentCreatorView.other.lifetimePoints")}
                </span>
              </div>
            </div>
            <ProfileAchievementsGrid achievements={profileAchievements?.achievements ?? []} />
          </section>
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
