import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@remix-run/react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import * as z from "zod";

import { useCreateCategory } from "~/api/mutations/admin/useCreateCategory";
import { CATEGORIES_QUERY_KEY } from "~/api/queries/useCategories";
import { queryClient } from "~/api/queryClient";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { DialogFooter } from "~/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { CreatePageHeader } from "~/modules/Admin/components";

const formSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters."),
});

type FormValues = z.infer<typeof formSchema>;

export default function CreateNewCategoryPage() {
  const { mutateAsync: createCategory } = useCreateCategory();
  const navigate = useNavigate();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
    },
  });

  const { t } = useTranslation();

  const onSubmit = (values: FormValues) => {
    createCategory({
      data: values,
    }).then(({ data }) => {
      queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });

      if (data.id) navigate(`/admin/categories/${data.id}`);
    });
  };

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
