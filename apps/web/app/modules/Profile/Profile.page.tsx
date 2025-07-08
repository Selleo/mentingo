import { zodResolver } from "@hookform/resolvers/zod";
import { Navigate, useParams } from "@remix-run/react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { useUpdateUserProfile } from "~/api/mutations";
import { useCurrentUser } from "~/api/queries";
import { useContentCreatorCourses } from "~/api/queries/useContentCreatorCourses";
import { useUserDetails } from "~/api/queries/useUserDetails";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { copyToClipboard } from "~/utils/copyToClipboard";
import { isAdminLike } from "~/utils/userRoles";

import Loader from "../common/Loader/Loader";
import { CoursesCarousel } from "../Dashboard/Courses/CoursesCarousel";

import { ProfileActionButtons, ProfileCard, ProfileEditCard } from "./components";
import { ProfilePageBreadcrumbs } from "./ProfilePageBreadcrumbs";

import type { UpdateFullUserBody } from "~/api/generated-api";

const updateFullUserSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  description: z.string(),
  contactEmail: z.string().email(),
  contactPhoneNumber: z.string(),
  jobTitle: z.string(),
});

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const { t } = useTranslation();
  const { id = "" } = useParams();

  const { data: userDetails, error } = useUserDetails(id);
  const { data: currentUser } = useCurrentUser();

  const { hasPermission, isProfileOwner } = useMemo(() => {
    return {
      hasPermission: isAdminLike(userDetails?.role ?? ""),
      isProfileOwner: currentUser?.id === userDetails?.id,
    };
  }, [userDetails, currentUser]);

  const { data: contentCreatorCourses } = useContentCreatorCourses(id, undefined, hasPermission);

  const toggleEditing = () => setIsEditing((prev) => !prev);

  const {
    handleSubmit,
    control,
    reset,
    formState: { isDirty },
  } = useForm<UpdateFullUserBody>({ resolver: zodResolver(updateFullUserSchema) });

  const { mutate: updateFullUser } = useUpdateUserProfile();

  const onSubmit = (data: UpdateFullUserBody) => {
    if (isDirty) {
      updateFullUser({ data, id: currentUser?.id ?? userDetails?.id ?? "" });
      reset(data);
      setIsEditing(false);
    }
  };

  const copyLinkToClipboard = () =>
    copyToClipboard(
      `${window.location.origin}/profile/${id}`,
      t("contentCreatorView.toast.profileLinkCopied"),
      t("contentCreatorView.toast.profileLinkCopyError"),
    );

  if (error) return <Navigate to="/" />;

  if (!userDetails)
    return (
      <div className="grid h-full w-full place-items-center">
        <Loader />
      </div>
    );

  return (
    <PageWrapper role="main">
      <ProfilePageBreadcrumbs
        id={id}
        username={`${userDetails?.firstName} ${userDetails?.lastName}`}
      />
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
            user={{
              firstName: userDetails?.firstName ?? undefined,
              lastName: userDetails?.lastName ?? undefined,
              description: userDetails?.description ?? undefined,
              contactEmail: userDetails?.contactEmail ?? undefined,
              contactPhoneNumber: userDetails?.contactPhone ?? undefined,
              jobTitle: userDetails?.jobTitle ?? undefined,
            }}
            isAdminLike={hasPermission}
          />
        ) : (
          <ProfileCard isAdminLike={hasPermission} userDetails={userDetails} />
        )}
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
      </div>
    </PageWrapper>
  );
}
