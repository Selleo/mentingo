import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";

import type { UseFormHandleSubmit, UseFormReset } from "react-hook-form";
import type { UpdateUserProfileBody } from "~/api/generated-api";

type EditModeActionButtonsProps = {
  handleSubmit: UseFormHandleSubmit<UpdateUserProfileBody, undefined>;
  onSubmit: (data: Partial<UpdateUserProfileBody>) => void;
  reset: UseFormReset<UpdateUserProfileBody>;
  toggleEditing: () => void;
};

export const EditModeActionButtons = ({
  handleSubmit,
  onSubmit,
  reset,
  toggleEditing,
}: EditModeActionButtonsProps) => {
  const { t } = useTranslation();

  return (
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
  );
};
