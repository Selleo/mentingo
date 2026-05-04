import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { cn } from "~/lib/utils";

import type { CourseFormData, CourseStatus, StepComponentProps } from "../types/scorm.types";

export function StatusStep({ handleBack, handleNext }: StepComponentProps) {
  const { setValue, watch } = useFormContext<CourseFormData>();
  const status = watch("status");
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <RadioGroup
        defaultValue={status}
        onValueChange={(value: CourseStatus) => setValue("status", value)}
      >
        <div className="space-y-4">
          <Card
            className={cn("flex items-start space-x-4 px-4", {
              "border-primary-500 bg-primary-50": status === "draft",
            })}
          >
            <RadioGroupItem value="draft" id="draft" className="my-5" />
            <Label
              htmlFor="draft"
              className="flex size-full flex-1 cursor-pointer flex-col gap-2 py-4"
            >
              <div className="text-lg font-medium">{t("common.other.draft")}</div>
              <div className="text-sm font-normal">{t("adminScorm.other.draftBody")}</div>
            </Label>
          </Card>

          <Card
            className={cn("flex items-start space-x-4 px-4", {
              "border-primary-500 bg-primary-50": status === "published",
            })}
          >
            <RadioGroupItem value="published" id="published" className="my-5" />
            <Label
              htmlFor="published"
              className="flex size-full flex-1 cursor-pointer flex-col gap-2 py-4"
            >
              <div className="text-lg font-medium">{t("common.other.publish")}</div>
              <div className="text-sm font-normal">{t("adminScorm.other.publishBody")}</div>
            </Label>
          </Card>
        </div>
      </RadioGroup>

      <div className="flex gap-3">
        <Button variant="outline" onClick={handleBack}>
          {t("adminScorm.button.back")}
        </Button>
        <Button onClick={handleNext}>{t("adminScorm.button.createCourse")}</Button>
      </div>
    </div>
  );
}
