import { useParams } from "@remix-run/react";
import { startCase } from "lodash-es";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useUpdateCategory } from "~/api/mutations/admin/useUpdateCategory";
import { categoryByIdQueryOptions, useCategoryById } from "~/api/queries/admin/useCategoryById";
import { queryClient } from "~/api/queryClient";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import Loader from "~/modules/common/Loader/Loader";

import { CategoryDetails } from "./CategoryDetails";

import type { MetaFunction } from "@remix-run/react";
import type { UpdateCategoryBody } from "~/api/generated-api";
import type { ParentRouteData } from "~/modules/layout";

const displayedFields: Array<keyof UpdateCategoryBody> = ["title", "archived"];

export const meta: MetaFunction = ({ matches }) => {
  const parentMatch = matches.find((match) => match.id.includes("layout"));
  const companyShortName = (parentMatch?.data as ParentRouteData)?.companyInfo?.data
    ?.companyShortName;
  const title = companyShortName ? `${companyShortName} - Category details` : "Category details";

  return [{ title }];
};

const Category = () => {
  const { id = "" } = useParams();
  const { t } = useTranslation();

  if (!id) throw new Error(t("adminCategoryView.error.categoryIdNotFound"));

  const { data: category, isLoading } = useCategoryById(id);
  const { mutateAsync: updateCategory } = useUpdateCategory();

  const {
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<UpdateCategoryBody>();

  if (isLoading)
    return (
      <div className="flex h-full items-center justify-center">
        <Loader />
      </div>
    );

  if (!category) throw new Error(t("adminCategoryView.error.categoryNotFound"));

  const onSubmit = (data: UpdateCategoryBody) => {
    updateCategory({ data, categoryId: id }).then(() => {
      queryClient.invalidateQueries(categoryByIdQueryOptions(id));
    });
  };

  const renderFields = () => {
    return displayedFields.map((field) => (
      <div key={field} className="flex flex-col gap-y-2">
        <Label className="font-normal text-neutral-600">
          {field === "archived" ? t("adminCategoryView.field.status") : startCase(t(field))}
        </Label>
        <CategoryDetails name={field} control={control} category={category} />
      </div>
    ));
  };

  const fields = renderFields();

  const breadcrumbs = [
    { title: t("adminCategoryView.breadcrumbs.categories"), href: "/admin/categories" },
    { title: t("adminCategoryView.breadcrumbs.categoryDetails"), href: `/admin/categories/${id}` },
  ];

  const backButton = { title: t("adminCategoryView.breadcrumbs.back"), href: "/admin/categories" };

  return (
    <PageWrapper breadcrumbs={breadcrumbs} backButton={backButton}>
      <div className="flex flex-col">
        <form onSubmit={handleSubmit(onSubmit)} className="h-full rounded-lg">
          <div className="flex items-center justify-between">
            <h2 className="mb-4 text-2xl font-semibold text-neutral-950">
              {t("adminCategoryView.editCategoryHeader")}
            </h2>
            <Button type="submit" disabled={!isDirty} className="mr-2">
              {t("common.button.save")}
            </Button>
          </div>
          <div className="space-y-4 pt-4">{fields}</div>
        </form>
      </div>
    </PageWrapper>
  );
};

export default Category;
