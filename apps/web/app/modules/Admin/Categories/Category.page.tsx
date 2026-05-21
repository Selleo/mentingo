import { useParams } from "@remix-run/react";
import { Tags } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useCategoryById } from "~/api/queries/admin/useCategoryById";
import { PageWrapper } from "~/components/PageWrapper";
import { Badge } from "~/components/ui/badge";
import Loader from "~/modules/common/Loader/Loader";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { setPageTitle } from "~/utils/setPageTitle";

import { CATEGORY_PAGE_HANDLES } from "../../../../e2e/data/categories/handles";

import { CategoryForm } from "./components/CategoryForm";
import { CategoryLanguagesSelector } from "./components/CategoryLanguagesSelector";

import type { MetaFunction } from "@remix-run/react";
import type { SupportedLanguages } from "@repo/shared";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.categoryDetails");

export default function CategoryPage() {
  const { id = "" } = useParams();

  const { t } = useTranslation();
  const appLanguage = useLanguageStore((state) => state.language);

  const [categoryLanguage, setCategoryLanguage] = useState<SupportedLanguages>(appLanguage);

  if (!id) throw new Error(t("adminCategoryView.error.categoryIdNotFound"));

  const { data: category, isLoading } = useCategoryById(id, categoryLanguage);

  const effectiveCategoryLanguage =
    category && !category.availableLocales.includes(categoryLanguage)
      ? category.baseLanguage
      : categoryLanguage;

  if (isLoading)
    return (
      <div className="flex h-full items-center justify-center">
        <Loader />
      </div>
    );

  if (!category) throw new Error(t("adminCategoryView.error.categoryNotFound"));

  const categoryFormKey = [
    category.id,
    effectiveCategoryLanguage,
    category.title,
    category.archived,
  ].join(":");

  const breadcrumbs = [
    { title: t("adminCategoryView.breadcrumbs.categories"), href: "/admin/categories" },
    { title: t("adminCategoryView.breadcrumbs.categoryDetails"), href: `/admin/categories/${id}` },
  ];

  return (
    <PageWrapper breadcrumbs={breadcrumbs}>
      <div className="flex flex-col gap-6" data-testid={CATEGORY_PAGE_HANDLES.PAGE}>
        <div className="rounded-xl border bg-gradient-to-r from-neutral-50 to-background p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-neutral-900">
                <Tags className="size-7 text-primary-700" />
                <h2 className="h4 text-neutral-950" data-testid={CATEGORY_PAGE_HANDLES.HEADING}>
                  {category.title}
                </h2>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={category.archived ? "outline" : "secondary"} className="capitalize">
                {category.archived ? t("common.other.archived") : t("common.other.active")}
              </Badge>
              <CategoryLanguagesSelector
                categoryId={id}
                value={effectiveCategoryLanguage}
                baseLanguage={category.baseLanguage}
                availableLocales={category.availableLocales}
                onChange={setCategoryLanguage}
              />
            </div>
          </div>
        </div>
        <CategoryForm
          key={categoryFormKey}
          category={category}
          categoryId={id}
          language={effectiveCategoryLanguage}
        />
      </div>
    </PageWrapper>
  );
}
