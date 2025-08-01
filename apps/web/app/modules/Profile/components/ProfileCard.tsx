import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { UserAvatar } from "~/components/UserProfile/UserAvatar";

import type { GetUserDetailsResponse } from "~/api/generated-api";

type ProfileCardProps = {
  isAdminLike: boolean;
  userDetails?: GetUserDetailsResponse["data"];
};

export const ProfileCard = ({ isAdminLike, userDetails }: ProfileCardProps) => {
  const { t } = useTranslation();

  return (
    <section className="flex w-full max-w-[720px] flex-col gap-y-6 rounded-b-lg rounded-t-2xl bg-white p-6 drop-shadow">
      <div className="flex flex-col gap-6 md:flex-row md:items-center">
        <UserAvatar
          className="size-32"
          userName={`${userDetails?.firstName} ${userDetails?.lastName}`}
          profilePictureUrl={userDetails?.profilePictureUrl}
        />
        <div className="flex w-full flex-col gap-4">
          <div className="flex flex-col gap-y-2">
            <h2 className="h6 md:h4 text-neutral-950" data-testid="username">
              {userDetails?.firstName} {userDetails?.lastName}
            </h2>
            {isAdminLike && (
              <div className="body-sm">
                <span className="text-neutral-900">{t("contentCreatorView.other.title")}:</span>{" "}
                <span className="font-medium text-neutral-950" data-testid="jobTitle">
                  {userDetails?.jobTitle}
                </span>
              </div>
            )}
          </div>
          {isAdminLike && (
            <div className="flex w-full flex-col gap-3 *:w-full md:flex-row md:*:w-fit">
              <a
                href={`tel:${userDetails?.contactPhone}`}
                className="body-sm-md md:body-base-md flex items-center justify-center gap-x-2 rounded-lg bg-primary-50 px-3 py-2 text-primary-700 md:justify-start"
              >
                <Icon name="Phone" className="size-5 text-neutral-900" />
                <span data-testid="contactPhone">{userDetails?.contactPhone}</span>
              </a>
              <a
                href={`mailto:${userDetails?.contactEmail}`}
                className="body-sm-md md:body-base-md flex items-center justify-center gap-x-2 rounded-lg bg-primary-50 px-2 py-1 text-primary-700 md:justify-start"
              >
                <Icon name="Email" className="size-5 text-neutral-900" />
                <span data-testid="contactEmail">{userDetails?.contactEmail}</span>
              </a>
            </div>
          )}
        </div>
      </div>
      {isAdminLike && (
        <div className="flex flex-col gap-y-2">
          <div className="flex items-center gap-x-3">
            <span className="min-w-fit text-neutral-900">
              {t("contentCreatorView.other.about")}
            </span>
            <div className="h-px w-full bg-primary-200" />
          </div>
          <p className="body-base mt-2 text-neutral-950" data-testid="description">
            {userDetails?.description}
          </p>
        </div>
      )}
      <Button variant="outline" className="sr-only">
        {t("contentCreatorView.button.collapse")}
      </Button>
    </section>
  );
};
