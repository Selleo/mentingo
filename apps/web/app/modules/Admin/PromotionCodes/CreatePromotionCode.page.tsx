import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@remix-run/react";
import { trim } from "lodash-es";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { useCreatePromotionCode } from "~/api/mutations/useCreatePromotionCode";
import { useCoursesSuspense } from "~/api/queries";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { DialogFooter } from "~/components/ui/dialog";
import { FormControl, FormField, FormItem, Form } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { convertToMinorUnits } from "~/lib/formatters/priceFormatter";
import { setPageTitle } from "~/utils/setPageTitle";

import { CreatePageHeader } from "../components";

import type { MetaFunction } from "@remix-run/react";

export const meta: MetaFunction = ({ matches }) =>
  setPageTitle(matches, "pages.createPromotionCode");

const formSchema = z
  .object({
    code: z.string().min(1, "Code is required."),
    discountType: z.enum(["percent", "fixed"]),
    discountValue: z.number({
      required_error: "Discount value is required.",
      invalid_type_error: "Discount value must be a number",
    }),
    assignedCourses: z.array(z.string()),
    maxRedemptions: z.number().optional(),
    expiresAt: z
      .string({
        required_error: "Expiration date is required",
      })
      .refine((val) => !Number.isNaN(Date.parse(val)), {
        message: "Expiration date must be a valid date",
      })
      .refine(
        (val) => {
          const date = new Date(val);
          return date >= new Date();
        },
        {
          message: "Expiration date must be in the future",
        },
      )
      .refine(
        (val) => {
          const date = new Date(val);
          const fiftyYearsFromNow = new Date();
          fiftyYearsFromNow.setFullYear(fiftyYearsFromNow.getFullYear() + 50);
          return date <= fiftyYearsFromNow;
        },
        {
          message: "Expiration date cannot be more than 50 years in the future",
        },
      ),
  })
  .superRefine((data, ctx) => {
    if (data.discountType === "percent") {
      if (data.discountValue < 0 || data.discountValue > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Discount value must be between 0 and 100.",
          path: ["discountValue"],
        });
      }
    }
  });

type FormData = z.infer<typeof formSchema>;

const CreatePromotionCode = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: courses } = useCoursesSuspense();
  const { mutateAsync: createCoupon } = useCreatePromotionCode();

  const coursesConnectedWithStripe = courses.filter(({ stripeProductId }) => stripeProductId);

  const form = useForm<FormData>({
    defaultValues: {
      code: "",
      discountType: "percent",
      discountValue: undefined,
      assignedCourses: [],
      maxRedemptions: undefined,
      expiresAt: undefined,
    },

    resolver: zodResolver(formSchema),
  });

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  const breadcrumbs = [
    { title: t("adminPromotionCodesView.breadcrumbs.dashboard"), href: "/" },
    {
      title: t("adminPromotionCodesView.breadcrumbs.promotionCodes"),
      href: "/admin/promotion-codes",
    },
    { title: t("adminPromotionCodesView.breadcrumbs.createNew"), href: "/admin/coupons/new" },
  ];

  const backButton = {
    title: t("adminPromotionCodesView.breadcrumbs.back"),
    href: "/admin/promotion-codes",
  };

  const onSubmit = (data: FormData) => {
    const payload = {
      code: trim(data.code),
      amountOff:
        data.discountType === "fixed" ? convertToMinorUnits(data.discountValue) : undefined,
      percentOff: data.discountType === "percent" ? data.discountValue : undefined,
      assignedStripeCourseIds: data?.assignedCourses,
      maxRedemptions: data?.maxRedemptions,
      expiresAt: data?.expiresAt,
      currency: "USD",
    };

    createCoupon(payload).then(() => navigate("/admin/promotion-codes"));
  };

  return (
    <PageWrapper breadcrumbs={breadcrumbs} backButton={backButton} className="relative">
      <div className="flex flex-col gap-y-6">
        <CreatePageHeader title={t("adminPromotionCodesView.headers.create")} description="" />
      </div>
      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <Label htmlFor="code" className="text-right">
                  {t("adminPromotionCodesView.field.code")}
                </Label>
                <FormControl>
                  <Input id="code" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
          {errors.code && <p className="text-sm text-destructive">{errors.code.message}</p>}
          <FormField
            control={control}
            name="discountType"
            render={({ field }) => (
              <FormItem>
                <Label htmlFor="discountType" className="text-right">
                  {t("adminPromotionCodesView.field.discountType")}
                </Label>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    value={field.value}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="percent" id="r2" />
                      <Label htmlFor="r2" className="cursor-pointer">
                        {t("adminPromotionCodesView.field.discountTypePercent", "Percent")}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="fixed" id="r1" />
                      <Label htmlFor="r1" className="cursor-pointer">
                        {t("adminPromotionCodesView.field.discountTypeFixed", "Fixed")}
                      </Label>
                    </div>
                  </RadioGroup>
                </FormControl>
              </FormItem>
            )}
          />
          {errors.discountType && (
            <p className="text-sm text-destructive">{errors.discountType.message}</p>
          )}
          <FormField
            control={control}
            name="discountValue"
            render={({ field }) => (
              <FormItem>
                <Label htmlFor="discountValue" className="text-right">
                  {t("adminPromotionCodesView.field.discountValue")}
                </Label>
                <FormControl>
                  <Input
                    id="discountValue"
                    {...field}
                    type="number"
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    onWheel={(e) => e.currentTarget.blur()}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          {errors.discountValue && (
            <p className="text-sm text-destructive">{errors.discountValue.message}</p>
          )}
          <FormField
            control={control}
            name="maxRedemptions"
            render={({ field }) => (
              <FormItem>
                <Label htmlFor="maxRedemptions" className="text-right">
                  {t("adminPromotionCodesView.field.maxRedemptions")}
                </Label>
                <FormControl>
                  <Input
                    id="maxRedemptions"
                    {...field}
                    type="number"
                    onWheel={(e) => e.currentTarget.blur()}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="expiresAt"
            render={({ field }) => (
              <FormItem>
                <Label htmlFor="expiresAt" className="text-right">
                  {t("adminPromotionCodesView.field.expiresAt")}
                </Label>
                <Input
                  id="expiresAt"
                  {...field}
                  type="date"
                  min={new Date().toISOString()}
                  value={field.value}
                />
              </FormItem>
            )}
          />
          {errors.expiresAt && (
            <p className="text-sm text-destructive">{errors.expiresAt.message}</p>
          )}
          <FormField
            control={control}
            name="assignedCourses"
            render={({ field }) => (
              <FormItem>
                <Label htmlFor="assignedCourses" className="text-right">
                  {t("adminPromotionCodesView.field.assignedCourses")}
                </Label>
                <div className="flex h-96 flex-col gap-4 overflow-auto">
                  <div className="flex items-center space-x-2 rounded-lg border border-neutral-200 p-2 pr-3">
                    <FormControl>
                      <Checkbox
                        onCheckedChange={(val) =>
                          field.onChange(
                            !val
                              ? []
                              : [
                                  ...courses
                                    .map(({ stripeProductId }) => stripeProductId)
                                    .filter(Boolean),
                                ],
                          )
                        }
                        onClick={(e) => e.stopPropagation()}
                        name={field.name}
                        aria-label="Checkbox"
                        id="checkAll"
                      />
                    </FormControl>
                    <Label
                      className="body-sm ml-2 cursor-pointer align-middle text-neutral-950"
                      htmlFor="checkAll"
                    >
                      {t(
                        "adminPromotionCodesView.field.associateCourse.checkAll",
                        "Apply to all courses",
                      )}
                    </Label>
                  </div>
                  {coursesConnectedWithStripe?.map(({ stripeProductId, title, id }) => {
                    return (
                      <div
                        key={id}
                        className="flex items-center space-x-2 rounded-lg border border-neutral-200 p-2 pr-3"
                      >
                        <FormControl>
                          <Checkbox
                            checked={
                              // some of the courses might not have a stripe product id
                              stripeProductId ? field?.value?.includes(stripeProductId) : false
                            }
                            onCheckedChange={() =>
                              field.onChange(
                                field?.value.find((_id) => _id === stripeProductId)
                                  ? field?.value.filter((_id) => _id !== stripeProductId)
                                  : [...field.value, stripeProductId],
                              )
                            }
                            onClick={(e) => e.stopPropagation()}
                            name={field.name}
                            aria-label="Checkbox"
                            id={id}
                          />
                        </FormControl>
                        <Label
                          className="body-sm ml-2 cursor-pointer align-middle text-neutral-950"
                          htmlFor={id}
                        >
                          {title}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </FormItem>
            )}
          />
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {t("adminPromotionCodesView.button.createCoupon")}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </PageWrapper>
  );
};

export default CreatePromotionCode;
