import { Link } from "@remix-run/react";
import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";

const GroupBreadcrumbsButton = () => {
  const { t } = useTranslation();
  return (
    <Link
      to="/admin/groups"
      className="mr-4 flex h-8 w-auto items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-center transition-colors hover:border-primary-800"
    >
      <Icon name={"ChevronLeft"} className="size-4"></Icon>
      <span className="body-sm text-primary-800">{t("common.button.back")}</span>
    </Link>
  );
};
export default GroupBreadcrumbsButton;
