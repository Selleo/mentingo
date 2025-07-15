import { match } from "ts-pattern";

import { EditModeActionButtons } from "./EditModeActionButtons";
import { OwnerViewActionButtons } from "./OwnerViewActionButtons";
import { VisitorViewActionButtons } from "./VisitorViewActionButtons";

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
  return match({ isEditing, isProfileOwner })
    .with({ isEditing: true, isProfileOwner: true }, () => (
      <EditModeActionButtons
        handleSubmit={handleSubmit}
        onSubmit={onSubmit}
        reset={reset}
        toggleEditing={toggleEditing}
      />
    ))
    .with({ isEditing: false, isProfileOwner: true }, () => (
      <OwnerViewActionButtons
        copyLinkToClipboard={copyLinkToClipboard}
        toggleEditing={toggleEditing}
      />
    ))
    .with({ isEditing: false, isProfileOwner: false }, () => (
      <VisitorViewActionButtons copyLinkToClipboard={copyLinkToClipboard} />
    ))
    .otherwise(() => null);
};
