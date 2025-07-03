import { useTranslation } from "react-i18next";

import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";

export const CreateGroupPageBreadcrumbs = () => {
  const { t } = useTranslation();
  return (
    <div className="mb-4 bg-primary-50">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href={`/`}>{t("adminGroupsView.breadcrumbs.dashboard")}</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href={`/admin/groups`}>
            {t("adminGroupsView.breadcrumbs.groups")}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem className="text-neutral-950">
          <BreadcrumbLink href={`/admin/groups/new`}>
            {t("adminGroupsView.breadcrumbs.createNew")}
          </BreadcrumbLink>
        </BreadcrumbItem>
      </BreadcrumbList>
    </div>
  );
};
