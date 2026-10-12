import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { cn } from "~/lib/utils";

import { useScormFormStore } from "../store/scormForm.store";

import type { CourseFormData, PricingType, StepComponentProps } from "../types/scorm.types";

export function PricingStep({ handleBack, handleNext }: StepComponentProps) {
  const { setValue, watch, register } = useFormContext<CourseFormData>();
  const currency = useScormFormStore((state) => state.formData.pricing?.currency);
  const pricingType = watch("pricing.type");
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <RadioGroup
        defaultValue={pricingType}
        onValueChange={(value: PricingType) => setValue("pricing.type", value)}
      >
        <div className="space-y-4">
          <Card
            className={cn("flex items-start space-x-4 pl-4", {
              "border-primary-500 bg-primary-50": pricingType === "free",
            })}
          >
            <RadioGroupItem value="free" id="free" className="my-5" />
            <Label
              variant="option"
              htmlFor="free"
              className="flex size-full flex-1 cursor-pointer flex-col gap-2 py-4"
            >
              <div className="text-lg font-medium">{t("adminScorm.other.free")}</div>
              <div className="text-sm font-normal">{t("adminScorm.other.freeCourseBody")}</div>
            </Label>
          </Card>

          <Card
            className={cn("flex items-start space-x-4 px-4", {
              "border-primary-500 bg-primary-50": pricingType === "paid",
            })}
          >
            <RadioGroupItem value="paid" id="paid" className="my-5" />
            <div className="flex flex-col py-4">
              <Label
                variant="option"
                htmlFor="paid"
                className="flex size-full flex-1 cursor-pointer flex-col gap-2"
              >
                <div className="text-lg font-medium">{t("adminScorm.other.paidCourse")}</div>
                <div className="text-sm font-normal">{t("adminScorm.other.paidCourseBody")}</div>
              </Label>

              {pricingType === "paid" && (
                <>
                  <Label className="mt-6 text-sm font-medium" htmlFor="price">
                    <span className="text-destructive">*</span> {t("adminScorm.field.price")}
                  </Label>
                  <div className="relative">
                    <Input
                      id="price"
                      {...register("pricing.price", {
                        valueAsNumber: true,
                      })}
                      placeholder={t("adminScorm.placeholder.price")}
                      type="number"
                    />
                    <span className="absolute right-0 top-1/2 -translate-x-4 -translate-y-1/2 uppercase">
                      {currency}
                    </span>
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      </RadioGroup>

      <div className="flex gap-3">
        <Button variant="outline" onClick={handleBack}>
          {t("adminScorm.button.back")}
        </Button>
        <Button onClick={handleNext}>{t("adminScorm.button.status")}</Button>
      </div>
    </div>
  );
}
