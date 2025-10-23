import { useNavigate } from "@remix-run/react";
import { useTranslation } from "react-i18next";

import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { DialogFooter } from "~/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { CreatePageHeader } from "~/modules/Admin/components";
import { setPageTitle } from "~/utils/setPageTitle";

import { useCreateCategoryForm } from "./hooks/useCreateCategoryForm";

import type { MetaFunction } from "@remix-run/react";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.createNewCategory");

export default function CreateNewCategoryPage() {
  const { form, onSubmit } = useCreateCategoryForm(({ data }) => {
    if (data.id) navigate(`/admin/categories/${data.id}`);
  });
  const navigate = useNavigate();

  const { t } = useTranslation();

  const isFormValid = form.formState.isValid;

  const breadcrumbs = [
    { title: t("adminCategoriesView.breadcrumbs.categories"), href: "/admin/categories" },
    { title: t("adminCategoriesView.breadcrumbs.createNew"), href: "/admin/categories/new" },
  ];

  const backButton = {
    title: t("adminCategoriesView.breadcrumbs.back"),
    href: "/admin/categories",
  };

  return (
    <PageWrapper breadcrumbs={breadcrumbs} backButton={backButton}>
      <div className="flex flex-col gap-y-6">
        <CreatePageHeader
          title={t("adminCategoryView.header")}
          description={t("adminCategoryView.subHeader")}
        />
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <Label htmlFor="title" className="text-right">
                    {t("adminCategoryView.field.title")}
                  </Label>
                  <FormControl>
                    <Input id="title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={!isFormValid}>
                {t("adminCategoryView.button.createCategory")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </div>
    </PageWrapper>
  );
}
