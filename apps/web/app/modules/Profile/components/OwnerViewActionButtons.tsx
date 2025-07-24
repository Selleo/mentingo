import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";

type OwnerViewActionButtonsProps = {
  copyLinkToClipboard: () => void;
  toggleEditing: () => void;
};

export const OwnerViewActionButtons = ({
  copyLinkToClipboard,
  toggleEditing,
}: OwnerViewActionButtonsProps) => {
  const { t } = useTranslation();

  return (
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
  );
};
