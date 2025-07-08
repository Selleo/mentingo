import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { type EditProfileFieldType, ProfileEditFieldRenderer } from "./ProfileEditFieldRenderer";

import type { Control } from "react-hook-form";
import type { UpdateFullUserBody } from "~/api/generated-api";

const personalInfoFields: EditProfileFieldType[] = [
  { name: "firstName", iconName: "User", type: "text" },
  { name: "lastName", iconName: "User", type: "text" },
  { name: "contactEmail", iconName: "Email", type: "email" },
  { name: "contactPhoneNumber", iconName: "Phone", type: "text" },
];

const aboutFields: EditProfileFieldType[] = [
  { name: "jobTitle", iconName: "Hat", type: "text" },
  { name: "description", type: "textarea" },
];

type ProfileEditCardProps = {
  user: UpdateFullUserBody;
  control: Control<UpdateFullUserBody>;
  isAdminLike: boolean;
};

export const ProfileEditCard = ({ user, control, isAdminLike }: ProfileEditCardProps) => {
  const { t } = useTranslation();

  const visiblePersonalFields = useMemo(
    () => personalInfoFields.filter(({ name }) => user[name as keyof UpdateFullUserBody]),
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
    </section>
  );
};
