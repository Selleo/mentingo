import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useParams } from "@remix-run/react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import useUpdateQA from "~/api/mutations/admin/useUpdateQA";
import useDeleteQA from "~/api/mutations/admin/useDeleteQA";
import useQA from "~/api/queries/useQA";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { qaFormSchema, type QAFormValues } from "~/modules/QA/qa.types";
import { setPageTitle } from "~/utils/setPageTitle";
import DeleteQADialog from "~/modules/QA/components/DeleteQADialog";

import type { MetaFunction } from "@remix-run/react";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.qa");

export default function EditQAPage() {
  const { t } = useTranslation();
  const { id: qaId } = useParams();
  const navigate = useNavigate();

  const { language } = useLanguageStore();

  const { data: qa, isLoading } = useQA(qaId ?? "", language);
  const { mutateAsync: updateQA, isPending: isUpdating } = useUpdateQA();
  const { mutateAsync: deleteQA, isPending: isDeleting } = useDeleteQA();

  const {
    handleSubmit,
    register,
    reset,
    formState: { errors, isValid },
  } = useForm<QAFormValues>({
    resolver: zodResolver(qaFormSchema),
    defaultValues: {
      title: qa?.title,
      description: qa?.description,
      language,
    },
    mode: "onChange",
  });

  useEffect(() => {
    if (qa) {
      reset({
        title: qa.title ?? "",
        description: qa.description ?? "",
        language,
      });
    }
  }, [qa, language, reset]);

  if (!(qa || isLoading)) throw new Error(t("qaView.toast.notFound"));

  const onSubmit = async (values: QAFormValues) => {
    if (!qaId) return;
    await updateQA({ qaId, ...values, language }).then(() => navigate("/qa"));
  };

  const onDelete = async () => {
    if (!qaId) return;
    await deleteQA(qaId);
    navigate("/qa");
  };

  return (
    <PageWrapper
      breadcrumbs={[
        { title: t("announcements.breadcrumbs.dashboard"), href: "/" },
        { title: t("navigationSideBar.qa"), href: "/qa" },
        { title: qa?.title ?? "", href: `/qa/${qaId}` },
      ]}
    >
      <div className="mt-8 flex justify-center">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex w-full max-w-[720px] flex-col gap-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-4 px-1">
            <div className="space-y-2">
              <h1 className="h5 md:h3">{t("qaView.edit.header")}</h1>
            </div>
            <div className="flex w-full items-center gap-3 md:w-auto">
              <div className="ml-auto flex items-center gap-3">
                <Link to="/qa">
                  <Button variant="outline">{t("common.button.cancel")}</Button>
                </Link>
                <Button type="submit" disabled={!isValid || isUpdating || isLoading}>
                  {t("common.button.save")}
                </Button>
              </div>
            </div>
          </div>

          <Card>
            <CardHeader className="pb-4 flex flex-row items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">{t("qaView.edit.header")}</h2>
                <p className="text-sm text-muted-foreground">{t("qaView.edit.subheader")}</p>
              </div>
              <DeleteQADialog onConfirm={onDelete} loading={isDeleting || isLoading} />
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="space-y-2">
                <Label htmlFor="title">
                  <span className="mr-1 text-error-600">*</span>
                  {t("qaView.fields.title")}
                </Label>
                <Input id="title" {...register("title")} />
                {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">
                  <span className="mr-1 text-error-600">*</span>
                  {t("qaView.fields.description")}
                </Label>
                <Textarea id="description" className="min-h-[180px]" {...register("description")} />
                {errors.description && (
                  <p className="text-sm text-destructive">{errors.description.message}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </PageWrapper>
  );
}
