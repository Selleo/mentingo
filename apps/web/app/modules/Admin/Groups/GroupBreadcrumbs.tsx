import { useTranslation } from "react-i18next";

import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import GroupBreadcrumbsButton from "~/modules/Admin/Groups/GroupBreadcrumbsButton";

interface GroupBreadcrumbsProps {
  name: string;
  href: string;
}
export const GroupPageBreadcrumbs = ({ name, href }: GroupBreadcrumbsProps) => {
  const { t } = useTranslation();
  return (
    <div className="mb-4 bg-primary-50">
      <BreadcrumbList>
        <GroupBreadcrumbsButton />
        <BreadcrumbItem>
          <BreadcrumbLink href={`/admin/groups`}>{t("navigationSideBar.groups")}</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem className="text-neutral-950">
          <BreadcrumbLink href={href}>{name}</BreadcrumbLink>
        </BreadcrumbItem>
      </BreadcrumbList>
    </div>
  );
};
