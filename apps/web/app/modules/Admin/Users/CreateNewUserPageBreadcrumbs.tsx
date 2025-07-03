import { useTranslation } from "react-i18next";

import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";

export const CreateNewUserPageBreadcrumbs = () => {
  const { t } = useTranslation();
  return (
    <div className="mb-4 bg-primary-50">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href={`/`}>{t("adminUsersView.breadcrumbs.dashboard")}</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href={`/admin/users`}>
            {t("adminUsersView.breadcrumbs.users")}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem className="text-neutral-950">
          <BreadcrumbLink href={`/admin/users/new`}>
            {t("adminUsersView.breadcrumbs.createNew")}
          </BreadcrumbLink>
        </BreadcrumbItem>
      </BreadcrumbList>
    </div>
  );
};
