import { startCase } from "lodash-es";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useUpdateCategory } from "~/api/mutations/admin/useUpdateCategory";
import { categoryByIdQueryOptions } from "~/api/queries/admin/useCategoryById";
import { queryClient } from "~/api/queryClient";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";

import { CATEGORY_PAGE_HANDLES } from "../../../../../e2e/data/categories/handles";
import { CategoryDetails } from "../CategoryDetails";

import type { CategoryDetailsField } from "../CategoryDetails";
import type { SupportedLanguages } from "@repo/shared";
import type { GetCategoryByIdResponse, UpdateCategoryBody } from "~/api/generated-api";

const displayedFields: CategoryDetailsField[] = ["title", "archived"];

type CategoryFormProps = {
  category: GetCategoryByIdResponse["data"];
  categoryId: string;
  language: SupportedLanguages;
};

export const CategoryForm = ({ category, categoryId, language }: CategoryFormProps) => {
  const { t } = useTranslation();
  const { mutate: updateCategory } = useUpdateCategory();

  const {
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<UpdateCategoryBody>();

  const onSubmit = (data: UpdateCategoryBody) => {
    updateCategory(
      { data: { ...data, language }, categoryId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries(categoryByIdQueryOptions(categoryId, language));
        },
      },
    );
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="rounded-xl border bg-background p-5 shadow-sm"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="h5 text-neutral-950">{t("adminCategoryView.editCategoryHeader")}</h3>
        </div>
        <Button
          type="submit"
          disabled={!isDirty}
          className="min-w-28"
          data-testid={CATEGORY_PAGE_HANDLES.SAVE}
        >
          {t("common.button.save")}
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {displayedFields.map((field) => (
          <div key={field} className={field === "title" ? "md:col-span-2" : ""}>
            <Label className="mb-2 inline-block text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {field === "archived"
                ? t("adminCategoryView.field.status")
                : startCase(t(`adminCategoryView.field.${field}`))}
            </Label>
            <CategoryDetails name={field} control={control} category={category} />
          </div>
        ))}
      </div>
    </form>
  );
};
