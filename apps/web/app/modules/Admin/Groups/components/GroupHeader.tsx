import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";

import type { ReactNode } from "react";

type CreatePageHeaderProps = {
  title: string | ReactNode;
  handlePublish: (e?: React.MouseEvent<HTMLButtonElement>) => void;
  handleCancel: () => void;
};

export const GroupHeader = ({ title, handlePublish, handleCancel }: CreatePageHeaderProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col justify-between gap-2 md:flex-row">
      <h2 className="h5 md:h3">{title}</h2>
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={handleCancel}
          className="flex w-full items-center justify-center gap-2 md:w-fit"
        >
          <Icon name="IconX" className="size-5" /> {t("adminGroupsView.newGroup.cancel")}
        </Button>
        <Button
          variant="primary"
          onClick={handlePublish}
          className="flex w-full items-center justify-center gap-2 md:w-fit"
        >
          <Icon name="Checkmark" className="size-5" /> {t("adminGroupsView.newGroup.submit")}
        </Button>
      </div>
    </div>
  );
};
