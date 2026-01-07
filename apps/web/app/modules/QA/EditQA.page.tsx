import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useParams } from "@remix-run/react";
import { isAxiosError } from "axios";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import useUpdateQA from "~/api/mutations/admin/useUpdateQA";
import useQA from "~/api/queries/useQA";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { QALanguageSelector } from "~/modules/QA/components/QALanguageSelector";
import { qaFormSchema, type QAFormValues } from "~/modules/QA/qa.types";
import { setPageTitle } from "~/utils/setPageTitle";

import type { MetaFunction } from "@remix-run/react";
import type { SupportedLanguages } from "@repo/shared";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.qa");

export default function EditQAPage() {
  const { t } = useTranslation();
  const { id: qaId } = useParams();
  const navigate = useNavigate();

  const { language } = useLanguageStore();

  const [qaLanguage, setQALanguage] = useState<SupportedLanguages>(language);

  const { data: qa, isLoading, isFetching, isError, error } = useQA(qaId ?? "", qaLanguage);

  const { mutateAsync: updateQA, isPending: isUpdating } = useUpdateQA();

  const { handleSubmit, register, reset, formState } = useForm<QAFormValues>({
    resolver: zodResolver(qaFormSchema),
    defaultValues: {
      title: "",
      description: "",
      language: qaLanguage,
    },
    mode: "onChange",
  });

  const { errors, isValid } = formState;

  useEffect(() => {
    if (!isFetching && qa && !qa.availableLocales?.includes(qaLanguage)) {
      setQALanguage(qa.baseLanguage ?? language);
    }
  }, [language, qaLanguage, qa, isFetching]);

  useEffect(() => {
    if (qa) {
      reset({
        title: qa.title ?? "",
        description: qa.description ?? "",
        language: qaLanguage,
      });
    }
  }, [qa, qaLanguage, reset]);

  if (isError && isAxiosError(error)) {
    throw new Error(t(error.response?.data.message));
  }

  if (!(qa || isLoading)) throw new Error(t("qaView.toast.notFound"));

  const onSubmit = async (values: QAFormValues) => {
    if (!qaId) return;
    await updateQA({ qaId, ...values, language: qaLanguage }).then(() => navigate("/qa"));
  };

  return (
    <PageWrapper
      breadcrumbs={[
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
                <h2 className="h5 md:h4">{t("qaView.edit.header")}</h2>
                <p className="body-sm-md md:body-base-md text-neutral-800">
                  {t("qaView.edit.subheader")}
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="space-y-2">
                <Label>{t("qaView.edit.language")}</Label>
                <QALanguageSelector qaLanguage={qaLanguage} qa={qa} onChange={setQALanguage} />
              </div>
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
