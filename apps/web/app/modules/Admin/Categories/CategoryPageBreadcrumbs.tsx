import { useTranslation } from "react-i18next";

import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";

type CategoryPageBreadcrumbsProps = {
  id: string;
};

export const CategoryPageBreadcrumbs = ({ id }: CategoryPageBreadcrumbsProps) => {
  const { t } = useTranslation();
  return (
    <div className="mb-4 bg-primary-50">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href={`/`}>{t("adminCategoryView.breadcrumbs.dashboard")}</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href={`/admin/categories`}>
            {t("adminCategoryView.breadcrumbs.categories")}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem className="text-neutral-950">
          <BreadcrumbLink href={`/admin/categories/${id}`}>
            {t("adminCategoryView.breadcrumbs.categoryDetails")}
          </BreadcrumbLink>
        </BreadcrumbItem>
      </BreadcrumbList>
    </div>
  );
};
