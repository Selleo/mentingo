import { useMemo, useRef } from "react";
import { Controller, type Control, type UseFormSetValue } from "react-hook-form";
import { useTranslation } from "react-i18next";

import ImageUploadInput from "~/components/FileUploadInput/ImageUploadInput";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { useHandleImageUpload } from "~/hooks/useHandleImageUpload";

import { type EditProfileFieldType, ProfileEditFieldRenderer } from "./ProfileEditFieldRenderer";

import type { UpdateUserProfileBody } from "../types";

const personalInfoFields: EditProfileFieldType[] = [
  { name: "firstName", iconName: "User", type: "text" },
  { name: "lastName", iconName: "User", type: "text" },
  { name: "contactEmail", iconName: "Email", type: "email" },
  { name: "contactPhone", iconName: "Phone", type: "text" },
];

const aboutFields: EditProfileFieldType[] = [
  { name: "jobTitle", iconName: "Hat", type: "text" },
  { name: "description", type: "textarea" },
];

type ProfileEditCardProps = {
  user: UpdateUserProfileBody;
  setValue: UseFormSetValue<UpdateUserProfileBody>;
  control: Control<UpdateUserProfileBody>;
  userAvatarUrl: string | null;
  isAdminLike: boolean;
};

export const ProfileEditCard = ({
  user,
  control,
  isAdminLike,
  setValue,
  userAvatarUrl: initialUserAvatarUrl,
}: ProfileEditCardProps) => {
  const { t } = useTranslation();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    imageUrl: userAvatarUrl,
    isUploading,
    handleImageUpload,
    removeImage,
  } = useHandleImageUpload({
    onUpload: (file) => {
      setValue("userAvatar", file);
    },
    onRemove: () => {
      setValue("userAvatar", null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    initialImageUrl: initialUserAvatarUrl,
  });

  const visiblePersonalFields = useMemo(
    () => personalInfoFields.filter(({ name }) => user[name as keyof UpdateUserProfileBody]),
    [user],
  );

  return (
    <section className="flex w-full max-w-[720px] flex-col gap-y-8 rounded-b-lg rounded-t-2xl bg-white p-6 drop-shadow">
      <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-6">
        <h2 className="h6 md:h4 text-neutral-950 md:col-span-2">
          {t("contentCreatorView.other.personalInfoTitle")}
        </h2>
        <p className="body-base-md mb-6 text-neutral-800 md:col-span-2">
          {t("contentCreatorView.other.personalInfoDescription")}
        </p>
        {visiblePersonalFields.map((field) => (
          <ProfileEditFieldRenderer
            key={String(field.name)}
            field={field}
            control={control}
            user={user}
            t={t}
          />
        ))}
      </div>
      {isAdminLike && (
        <>
          <hr className="h-px bg-primary-200" />
          <div className="flex flex-col">
            <h2 className="h6 md:h4 text-neutral-950">
              {t("contentCreatorView.other.aboutTitle")}
            </h2>
            <p className="body-base-md mb-6 text-neutral-800">
              {t("contentCreatorView.other.aboutDescription")}
            </p>
            {aboutFields.map((field) => (
              <ProfileEditFieldRenderer
                key={String(field.name)}
                field={field}
                control={control}
                user={user}
                t={t}
              />
            ))}
          </div>
        </>
      )}
      <hr className="h-px bg-primary-200" />
      <div className="flex flex-col">
        <h2 className="h6 md:h4 text-neutral-950">
          {t("contentCreatorView.other.appearanceTitle")}
        </h2>
        <p className="body-base-md mb-6 text-neutral-800">
          {t("contentCreatorView.other.appearanceDescription")}
        </p>
        <Controller
          key="userAvatar"
          name="userAvatar"
          control={control}
          render={({ field }) => (
            <div className="mb-4 flex flex-col gap-y-2">
              <Label htmlFor="fileUrl">{t("contentCreatorView.field.uploadThumbnailLabel")}</Label>
              <ImageUploadInput
                field={{
                  ...field,
                  value: userAvatarUrl || undefined,
                }}
                handleImageUpload={handleImageUpload}
                isUploading={isUploading}
                imageUrl={userAvatarUrl}
                fileInputRef={fileInputRef}
              />
              {isUploading && <p>{t("common.other.uploadingImage")}</p>}
            </div>
          )}
        />
        {userAvatarUrl && (
          <Button
            onClick={removeImage}
            className="mb-4 mt-4 rounded bg-red-500 px-6 py-2 text-white"
          >
            <Icon name="TrashIcon" className="mr-2" />
            {t("contentCreatorView.button.deleteProfilePicture")}
          </Button>
        )}
      </div>
    </section>
  );
};
