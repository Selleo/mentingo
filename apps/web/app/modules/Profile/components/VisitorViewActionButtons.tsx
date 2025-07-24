import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";

type VisitorViewActionButtonsProps = {
  copyLinkToClipboard: () => void;
};

export const VisitorViewActionButtons = ({
  copyLinkToClipboard,
}: VisitorViewActionButtonsProps) => {
  const { t } = useTranslation();

  return (
    <Button variant="outline" className="w-full md:w-fit" onClick={copyLinkToClipboard}>
      <Icon className="mr-2 size-5" name="Share" />
      {t("contentCreatorView.button.share")}
    </Button>
  );
};
