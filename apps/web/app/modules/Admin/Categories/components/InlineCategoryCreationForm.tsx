import { useTranslation } from "react-i18next";

import { categoriesQueryOptions } from "~/api/queries/useCategories";
import { queryClient } from "~/api/queryClient";
import { Button } from "~/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";

import { useCreateCategoryForm } from "../hooks/useCreateCategoryForm";

type InlineCategoryCreationFormProps = {
  onCategoryCreated?: (categoryId: string) => void;
};

export const InlineCategoryCreationForm = ({
  onCategoryCreated,
}: InlineCategoryCreationFormProps) => {
  const { t } = useTranslation();

  const { form: createCategoryForm, onSubmit: createCategoryOnSubmit } = useCreateCategoryForm(
    async ({ data }) => {
      if (data.id) {
        await queryClient.invalidateQueries({ queryKey: categoriesQueryOptions().queryKey });
        onCategoryCreated?.(data.id);
        createCategoryForm.reset();
      }
    },
  );

  const { isValid: createCategoryIsFormValid } = createCategoryForm.formState;

  return (
    <>
      <Separator className="my-1" />
      <Form {...createCategoryForm}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            createCategoryForm.handleSubmit(createCategoryOnSubmit)();
          }}
          className="flex flex-col gap-2 px-2 py-2"
        >
          <FormField
            control={createCategoryForm.control}
            name="title"
            render={({ field }) => (
              <FormItem className="w-full">
                <Label
                  htmlFor="create-category-title"
                  className="text-xs font-medium text-neutral-700"
                >
                  {t("adminCategoryView.field.newCategoryName")}
                </Label>
                <div className="flex gap-2">
                  <FormControl>
                    <Input
                      id="create-category-title"
                      {...field}
                      onKeyDown={(e) => e.stopPropagation()}
                      className="h-full flex-1 text-sm"
                      placeholder={t("adminCategoryView.placeholder.categoryName")}
                    />
                  </FormControl>
                  <Button type="submit" disabled={!createCategoryIsFormValid} size="sm">
                    {t("adminCategoryView.button.createCategory")}
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </>
  );
};
