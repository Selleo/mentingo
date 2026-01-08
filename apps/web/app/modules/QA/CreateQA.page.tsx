import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "@remix-run/react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import useCreateQA from "~/api/mutations/admin/useCreateQA";
import { Icon } from "~/components/Icon";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { FormField, FormItem } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { courseLanguages } from "~/modules/Admin/EditCourse/compontents/CourseLanguageSelector";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { qaFormSchema, type QAFormValues } from "~/modules/QA/qa.types";
import { setPageTitle } from "~/utils/setPageTitle";

import type { MetaFunction } from "@remix-run/react";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.qa");

export default function CreateQAPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { language } = useLanguageStore();
  const { mutateAsync: createQA, isPending } = useCreateQA();

  const {
    handleSubmit,
    register,
    control,
    formState: { errors, isValid },
  } = useForm<QAFormValues>({
    resolver: zodResolver(qaFormSchema),
    defaultValues: { title: "", description: "", language },
    mode: "onChange",
  });

  const onSubmit = async (values: QAFormValues) => {
    await createQA(values).then(() => navigate("/qa"));
  };

  return (
    <PageWrapper
      breadcrumbs={[
        { title: t("navigationSideBar.qa"), href: "/qa" },
        { title: t("qaView.button.createNew"), href: "/qa/new" },
      ]}
    >
      <div className="mt-8 flex justify-center">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex w-full max-w-[720px] flex-col gap-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-4 px-1">
            <h1 className="h5 md:h3">{t("qaView.create.header")}</h1>
            <div className="flex items-center gap-3">
              <Link to="/qa">
                <Button variant="outline">{t("common.button.cancel")}</Button>
              </Link>
              <Button type="submit" disabled={!isValid || isPending}>
                {t("qaView.button.createNew")}
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader className="pb-4">
              <h2 className="h5 md:h4">{t("qaView.create.header")}</h2>
              <p className="body-sm-md md:body-base-md text-neutral-800">
                {t("qaView.create.subheader")}
              </p>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="space-y-2">
                <FormField
                  render={({ field }) => (
                    <div data-testid="select-language">
                      <FormItem>
                        <Label className="flex gap-4 items-center mt-5">
                          <div>
                            <span className="text-red-500">*</span>{" "}
                            {t("adminCourseView.settings.field.baseLanguage")}
                          </div>
                          <TooltipProvider delayDuration={0}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Icon
                                    name="Info"
                                    className="h-auto w-5 cursor-default text-neutral-400"
                                  />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                align="center"
                                className="max-w-xs whitespace-pre-line break-words rounded bg-black px-2 py-1 text-sm text-white shadow-md"
                              >
                                {t("qaView.create.baseLanguageTooltip")}
                                <TooltipArrow className="fill-black" />
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </Label>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {courseLanguages.map((item) => (
                              <SelectItem value={item.key} key={item.key} className="w-full">
                                <div className="flex w-full items-center gap-2">
                                  <Icon name={item.iconName} className="size-4" />
                                  <span className="font-semibold">{t(item.translationKey)}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    </div>
                  )}
                  name="language"
                  control={control}
                ></FormField>
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
