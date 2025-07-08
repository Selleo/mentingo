import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";

import type { UseFormHandleSubmit, UseFormReset } from "react-hook-form";
import type { UpdateUserProfileBody } from "~/api/generated-api";

type ProfileActionButtonsProps = {
  isEditing: boolean;
  isProfileOwner: boolean;
  toggleEditing: () => void;
  copyLinkToClipboard: () => void;
  handleSubmit: UseFormHandleSubmit<UpdateUserProfileBody, undefined>;
  onSubmit: (data: Partial<UpdateUserProfileBody>) => void;
  reset: UseFormReset<UpdateUserProfileBody>;
};

export const ProfileActionButtons = ({
  isEditing,
  isProfileOwner,
  toggleEditing,
  copyLinkToClipboard,
  handleSubmit,
  onSubmit,
  reset,
}: ProfileActionButtonsProps) => {
  const { t } = useTranslation();

  return match({ isEditing, isProfileOwner })
    .with({ isEditing: true, isProfileOwner: true }, () => (
      <>
        <Button
          variant="outline"
          className="w-full md:w-fit"
          onClick={() => {
            reset();
            toggleEditing();
          }}
        >
          <Icon className="mr-2 size-3" name="X" />
          {t("contentCreatorView.button.cancel")}
        </Button>
        <Button
          className="w-full md:w-fit"
          onClick={() => {
            handleSubmit(onSubmit)();
            toggleEditing();
          }}
        >
          <Icon className="mr-2 size-4" name="Checkmark" />
          {t("contentCreatorView.button.confirm")}
        </Button>
      </>
    ))
    .with({ isEditing: false, isProfileOwner: true }, () => (
      <>
        <Button variant="outline" className="w-full md:w-fit" onClick={copyLinkToClipboard}>
          <Icon className="mr-2 size-5" name="Share" />
          {t("contentCreatorView.button.share")}
        </Button>
        <Button className="w-full md:w-fit" onClick={toggleEditing}>
          <Icon className="mr-2 size-4" name="Edit" />
          {t("contentCreatorView.button.edit")}
        </Button>
      </>
    ))
    .with({ isEditing: false, isProfileOwner: false }, () => (
      <Button variant="outline" className="w-full md:w-fit" onClick={copyLinkToClipboard}>
        <Icon className="mr-2 size-5" name="Share" />
        {t("contentCreatorView.button.share")}
      </Button>
    ))
    .otherwise(() => null);
};
