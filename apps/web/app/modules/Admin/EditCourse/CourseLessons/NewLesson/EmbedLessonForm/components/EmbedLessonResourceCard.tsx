import { useTranslation } from "react-i18next";

import { FormCheckbox } from "~/components/Form/FormCheckbox";
import { FormTextField } from "~/components/Form/FormTextField";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

import type { EmbedLessonFormValues } from "../schemas/embedLessonForm.schema";
import type { UseFormReturn } from "react-hook-form";

interface EmbedLessonResourceCardProps {
  form: UseFormReturn<EmbedLessonFormValues>;
  resourceIndex: number;
  hasError: boolean;
}

export const EmbedLessonResourceCard = ({
  form,
  hasError,
  resourceIndex,
}: EmbedLessonResourceCardProps) => {
  const { t } = useTranslation();

  const handleRemoveResource = () => {
    const currentResources = form.getValues("resources") || [];
    const updatedResources = currentResources.filter((_, i: number) => i !== resourceIndex);
    form.setValue("resources", updatedResources, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  return (
    <div
      className={cn("flex flex-col gap-y-4 rounded-xl border p-4 transition-all duration-300", {
        "border-red-500": hasError,
      })}
    >
      <FormTextField
        className="grow"
        name={`resources.${resourceIndex}.source`}
        control={form.control}
        label={t("adminCourseView.curriculum.lesson.field.sourceUrl")}
        placeholder={t("adminCourseView.curriculum.lesson.placeholder.sourceUrl")}
        required
      />
      <FormCheckbox
        name={`resources.${resourceIndex}.allowFullscreen`}
        control={form.control}
        label={t("adminCourseView.curriculum.lesson.placeholder.allowFullscreen")}
      />
      <Button
        type="button"
        onClick={handleRemoveResource}
        className="mt-2 w-fit border border-red-500 bg-transparent text-red-500 hover:bg-red-100"
      >
        {t("adminCourseView.curriculum.lesson.button.removeResource")}
      </Button>
    </div>
  );
};
