import { useTranslation } from "react-i18next";

import { PriceInput } from "~/components/PriceInput/PriceInput";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Form } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";

import { COURSE_PRICING_HANDLES } from "../../../../../e2e/data/courses/handles";

import { useCoursePricingForm } from "./hooks/useCoursePricingForm";

import type { SupportedLanguages } from "@repo/shared";

type CoursePricingProps = {
  courseId: string;
  priceInCents?: number;
  currency?: string;
  language: SupportedLanguages;
  className?: string;
  variant?: "legacy" | "settings";
};

const CoursePricing = ({
  courseId,
  priceInCents,
  currency,
  language,
  className,
  variant = "legacy",
}: CoursePricingProps) => {
  const { form, onSubmit } = useCoursePricingForm({ courseId, priceInCents, currency, language });
  const { setValue, watch } = form;
  const { t } = useTranslation();

  const isFree = watch("isFree");
  const isSettingsVariant = variant === "settings";
  const formId = `course-pricing-form-${courseId}`;
  return (
    <div
      className={cn(
        "flex w-full max-w-[744px] flex-col gap-y-6 bg-white p-8",
        { "gap-y-4": isSettingsVariant },
        className,
      )}
    >
      <div className={cn({ "flex items-start justify-between gap-4": isSettingsVariant })}>
        <div className={cn("flex flex-col gap-y-1.5", { "gap-1": isSettingsVariant })}>
          <h5
            className={cn("text-neutral-950", {
              h5: !isSettingsVariant,
              "text-base font-semibold": isSettingsVariant,
            })}
          >
            {t("adminCourseView.pricing.header")}
          </h5>
          <p
            className={cn("text-neutral-900", {
              "body-base": !isSettingsVariant,
              "text-sm": isSettingsVariant,
            })}
          >
            {t("adminCourseView.pricing.subHeader")}
          </p>
        </div>
        {isSettingsVariant && (
          <Button data-testid={COURSE_PRICING_HANDLES.SAVE_BUTTON} type="submit" form={formId}>
            {t("common.button.save")}
          </Button>
        )}
      </div>
      <Form {...form}>
        <form
          id={formId}
          onSubmit={form.handleSubmit(onSubmit)}
          className={cn("flex flex-col gap-y-6", { "gap-y-4": isSettingsVariant })}
        >
          <div className={cn("flex flex-col space-y-6", { "space-y-3": isSettingsVariant })}>
            <Card
              data-testid={COURSE_PRICING_HANDLES.FREE_CARD}
              className={cn(
                "flex w-full cursor-pointer items-start gap-x-4 rounded-md border px-6 py-4",
                {
                  "gap-3 rounded-lg border-neutral-300 bg-white p-4 shadow-none transition-colors hover:border-primary-300":
                    isSettingsVariant,
                  "border-primary-500 bg-primary-50/40": isFree === true && isSettingsVariant,
                  "border-primary-500 bg-primary-50": isFree === true && !isSettingsVariant,
                },
              )}
              onClick={() => setValue("isFree", true)}
            >
              <div className={cn("mt-1.5", { "mt-1": isSettingsVariant })}>
                <Input
                  type="radio"
                  name="isFree"
                  checked={isFree === true}
                  onChange={() => setValue("isFree", true)}
                  className="size-4 cursor-pointer p-1"
                  id="isFree"
                />
              </div>
              <Label
                htmlFor="isFree"
                className={cn("cursor-pointer text-neutral-950", {
                  "body-lg-md": !isSettingsVariant,
                })}
              >
                <div
                  className={cn("text-neutral-950", {
                    "body-lg-md mb-2": !isSettingsVariant,
                    "text-base font-semibold": isSettingsVariant,
                  })}
                >
                  {t("adminCourseView.pricing.freeCourseHeader")}
                </div>
                <div
                  className={cn({
                    "body-base": !isSettingsVariant,
                    "mt-1 text-sm text-neutral-800": isSettingsVariant,
                    "text-neutral-900": !isFree && !isSettingsVariant,
                    "text-neutral-950": isFree && !isSettingsVariant,
                  })}
                >
                  {t("adminCourseView.pricing.freeCourseBody")}
                </div>
              </Label>
            </Card>

            <Card
              data-testid={COURSE_PRICING_HANDLES.PAID_CARD}
              className={cn(
                "flex w-full cursor-pointer items-start gap-x-4 rounded-md border px-6 py-4",
                {
                  "gap-3 rounded-lg border-neutral-300 bg-white p-4 shadow-none transition-colors hover:border-primary-300":
                    isSettingsVariant,
                  "border-primary-500 bg-primary-50/40": isFree === false && isSettingsVariant,
                  "border-primary-500 bg-primary-50": isFree === false && !isSettingsVariant,
                },
              )}
              onClick={() => setValue("isFree", false)}
            >
              <div className={cn("mt-1.5", { "mt-1": isSettingsVariant })}>
                <Input
                  type="radio"
                  name="isPaid"
                  checked={isFree === false}
                  onChange={() => setValue("isFree", false)}
                  className="size-4 cursor-pointer p-1 pt-4"
                  id="isPaid"
                />
              </div>
              <div className={cn({ "min-w-0 flex-1": isSettingsVariant })}>
                <Label
                  htmlFor="isPaid"
                  className={cn("cursor-pointer text-neutral-950", {
                    "body-lg-md": !isSettingsVariant,
                  })}
                >
                  <div
                    className={cn("text-neutral-950", {
                      "body-lg-md mb-2": !isSettingsVariant,
                      "text-base font-semibold": isSettingsVariant,
                    })}
                  >
                    {t("adminCourseView.pricing.paidCourseHeader")}
                  </div>
                  <div
                    className={cn({
                      "body-base": !isSettingsVariant,
                      "mt-1 text-sm text-neutral-800": isSettingsVariant,
                      "text-neutral-900": isFree && !isSettingsVariant,
                      "text-neutral-950": !isFree && !isSettingsVariant,
                    })}
                  >
                    {t("adminCourseView.pricing.paidCourseBody")}
                  </div>
                </Label>
                {isFree === false && (
                  <>
                    <div className="mb-1 mt-4">
                      <Label className="text-sm font-medium" htmlFor="price">
                        <span className="text-destructive">*</span>{" "}
                        {t("adminCourseView.pricing.field.price")}
                      </Label>
                    </div>
                    <div className="mb-2">
                      <PriceInput
                        data-testid={COURSE_PRICING_HANDLES.PRICE_INPUT}
                        value={form.getValues("priceInCents")}
                        onChange={(value) => setValue("priceInCents", value)}
                        currency={currency}
                        placeholder={t("adminCourseView.pricing.placeholder.amount")}
                        className={cn(
                          "[&::-moz-appearance]:textfield appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                          {
                            "border-error-600": form.formState.errors.priceInCents,
                          },
                        )}
                        id="price"
                        aria-label={t("adminCourseView.pricing.field.price")}
                      />
                      {form.formState.errors.priceInCents && (
                        <p className="text-xs text-error-600">
                          {form.formState.errors.priceInCents.message}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </Card>
          </div>
          {!isSettingsVariant && (
            <Button data-testid={COURSE_PRICING_HANDLES.SAVE_BUTTON} className="w-20" type="submit">
              {t("common.button.save")}
            </Button>
          )}
        </form>
      </Form>
    </div>
  );
};

export default CoursePricing;
