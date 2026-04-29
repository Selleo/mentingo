import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { useUpdateGamificationPointDefaults } from "~/api/mutations/admin/useUpdateGamificationPointDefaults";
import { FormTextField } from "~/components/Form/FormTextField";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Form } from "~/components/ui/form";

import type { GlobalSettings } from "../../types";

const gamificationPointDefaultsSchema = z.object({
  defaultChapterPoints: z.coerce.number().int().min(0),
  defaultCoursePoints: z.coerce.number().int().min(0),
  defaultAiPassPoints: z.coerce.number().int().min(0),
});

type GamificationPointDefaultsFormValues = z.infer<typeof gamificationPointDefaultsSchema>;

type GamificationPointDefaultsProps = {
  globalSettings: GlobalSettings;
};

export function GamificationPointDefaults({ globalSettings }: GamificationPointDefaultsProps) {
  const { t } = useTranslation();
  const { mutate: updateGamificationPointDefaults, isPending } =
    useUpdateGamificationPointDefaults();

  const form = useForm<GamificationPointDefaultsFormValues>({
    resolver: zodResolver(gamificationPointDefaultsSchema),
    defaultValues: {
      defaultChapterPoints: globalSettings.defaultChapterPoints,
      defaultCoursePoints: globalSettings.defaultCoursePoints,
      defaultAiPassPoints: globalSettings.defaultAiPassPoints,
    },
  });

  useEffect(() => {
    form.reset({
      defaultChapterPoints: globalSettings.defaultChapterPoints,
      defaultCoursePoints: globalSettings.defaultCoursePoints,
      defaultAiPassPoints: globalSettings.defaultAiPassPoints,
    });
  }, [form, globalSettings]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("gamificationPointDefaults.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            className="flex flex-col gap-4"
            onSubmit={form.handleSubmit((values) => updateGamificationPointDefaults(values))}
          >
            <div className="grid gap-4 md:grid-cols-3">
              <FormTextField
                control={form.control}
                name="defaultChapterPoints"
                type="number"
                label={t("gamificationPointDefaults.fields.defaultChapterPoints")}
                min={0}
              />
              <FormTextField
                control={form.control}
                name="defaultCoursePoints"
                type="number"
                label={t("gamificationPointDefaults.fields.defaultCoursePoints")}
                min={0}
              />
              <FormTextField
                control={form.control}
                name="defaultAiPassPoints"
                type="number"
                label={t("gamificationPointDefaults.fields.defaultAiPassPoints")}
                min={0}
              />
            </div>
            <Button type="submit" disabled={!form.formState.isDirty || isPending}>
              {t("common.button.save")}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
