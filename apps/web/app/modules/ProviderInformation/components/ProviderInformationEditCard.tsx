import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";

import {
  companyInformationFormSchema,
  type CompanyInformationFormValues,
} from "../schemas/companyInformationFormSchema";

type ProviderInformationEditCardProps = {
  data: CompanyInformationFormValues;
  onSubmit: (data: CompanyInformationFormValues) => void;
  onCancel: () => void;
  isLoading: boolean;
};

export const ProviderInformationEditCard = ({
  data,
  onSubmit,
  onCancel,
  isLoading,
}: ProviderInformationEditCardProps) => {
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CompanyInformationFormValues>({
    resolver: zodResolver(companyInformationFormSchema(t)),
    defaultValues: data,
  });

  return (
    <section className="flex w-full max-w-[720px] flex-col gap-y-6 rounded-b-lg rounded-t-2xl bg-white p-6 drop-shadow">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <div className="space-y-2">
          <Label htmlFor="company_name">{t("providerInformation.companyName")}</Label>
          <Input
            id="company_name"
            className={cn({
              "border-red-500 focus:!ring-red-500": errors.company_name,
            })}
            {...register("company_name")}
          />
          {errors.company_name && (
            <p className="mt-1 text-xs text-red-500">{errors.company_name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="registered_address">{t("providerInformation.registeredAddress")}</Label>
          <Textarea
            id="registered_address"
            className={cn({
              "border-red-500 focus:!ring-red-500": errors.registered_address,
            })}
            {...register("registered_address")}
          />
          {errors.registered_address && (
            <p className="mt-1 text-xs text-red-500">{errors.registered_address.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="tax_number">{t("providerInformation.taxNumber")}</Label>
          <Input
            id="tax_number"
            placeholder="1234567890"
            className={cn({
              "border-red-500 focus:!ring-red-500": errors.tax_number,
            })}
            {...register("tax_number")}
          />
          {errors.tax_number && (
            <p className="mt-1 text-xs text-red-500">{errors.tax_number.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email_address">{t("providerInformation.emailAddress")}</Label>
          <Input
            id="email_address"
            type="email"
            className={cn({
              "border-red-500 focus:!ring-red-500": errors.email_address,
            })}
            {...register("email_address")}
          />
          {errors.email_address && (
            <p className="mt-1 text-xs text-red-500">{errors.email_address.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="court_register_number">
            {t("providerInformation.courtRegisterNumber")}
          </Label>
          <Input
            id="court_register_number"
            placeholder="0000123456"
            className={cn({
              "border-red-500 focus:!ring-red-500": errors.court_register_number,
            })}
            {...register("court_register_number")}
          />
          {errors.court_register_number && (
            <p className="mt-1 text-xs text-red-500">{errors.court_register_number.message}</p>
          )}
        </div>

        <div className="flex gap-2 pt-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? t("common.button.saving") : t("common.button.save")}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            {t("common.button.cancel")}
          </Button>
        </div>
      </form>
    </section>
  );
};
