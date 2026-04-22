import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useSearchParams } from "@remix-run/react";
import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { FormProvider, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { useCreatePassword } from "~/api/mutations/useCreatePassword";
import { useResetPassword } from "~/api/mutations/useResetPassword";
import PasswordValidationDisplay from "~/components/PasswordValidation/PasswordValidationDisplay";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useToast } from "~/components/ui/use-toast";
import { cn } from "~/lib/utils";
import { passwordSchema } from "~/modules/Dashboard/Settings/schema/password.schema";
import { detectBrowserLanguage } from "~/utils/browser-language";
import { setPageTitle } from "~/utils/setPageTitle";

import type { MetaFunction } from "@remix-run/react";

type CreateNewPasswordFormValues = {
  newPassword: string;
  newPasswordConfirmation: string;
};

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.createNewPassword");

const createNewPasswordSchema = (t: (key: string) => string) =>
  z
    .object({
      newPassword: passwordSchema,
      newPasswordConfirmation: z.string(),
    })
    .refine(({ newPassword, newPasswordConfirmation }) => newPassword === newPasswordConfirmation, {
      message: t("createPasswordView.validation.passwordsDontMatch"),
      path: ["newPasswordConfirmation"],
    });

export default function CreateNewPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const resetToken = searchParams.get("resetToken");
  const createToken = searchParams.get("createToken");
  const { mutateAsync: createPassword } = useCreatePassword();
  const { mutateAsync: resetPassword } = useResetPassword();
  const { t } = useTranslation();

  const methods = useForm<CreateNewPasswordFormValues>({
    resolver: zodResolver(createNewPasswordSchema(t)),
    mode: "onChange",
    defaultValues: {
      newPassword: "",
      newPasswordConfirmation: "",
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = methods;

  const onSubmit = (data: Pick<CreateNewPasswordFormValues, "newPassword">) => {
    if (!resetToken && !createToken) {
      toast({
        variant: "destructive",
        description: t("createPasswordView.error.invalidToken"),
      });
      return;
    }

    if (resetToken) {
      resetPassword({
        data: { newPassword: data.newPassword, resetToken },
      }).then(() => {
        toast({
          description: t("changePasswordView.toast.passwordChangedSuccessfully"),
        });
        navigate("/auth/login");
      });
    }

    if (createToken) {
      createPassword({
        data: {
          password: data.newPassword,
          createToken,
          language: Object.values(SUPPORTED_LANGUAGES).includes(detectBrowserLanguage())
            ? detectBrowserLanguage()
            : SUPPORTED_LANGUAGES.EN,
        },
      }).then(() => {
        toast({
          description: t("changePasswordView.toast.passwordCreatedSuccessfully"),
        });
      });
    }
  };

  return (
    <FormProvider {...methods}>
      <Card className="mx-auto max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">{t("createPasswordView.header")}</CardTitle>
          <CardDescription>{t("createPasswordView.subHeader")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="grid max-w-sm gap-2">
              <Label htmlFor="newPassword">{t("createPasswordView.field.password")}</Label>
              <Input
                id="newPassword"
                type="password"
                className={cn({ "border-red-500": errors.newPassword })}
                {...register("newPassword")}
              />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="newPasswordConfirmation">
                  {t("createPasswordView.field.confirmPassword")}
                </Label>
              </div>
              <Input
                id="newPasswordConfirmation"
                type="password"
                className={cn({
                  "border-red-500": errors.newPasswordConfirmation,
                })}
                {...register("newPasswordConfirmation")}
              />
              {errors.newPasswordConfirmation && (
                <div className="text-sm text-red-500">{errors.newPasswordConfirmation.message}</div>
              )}
            </div>

            <PasswordValidationDisplay fieldName="newPassword" />

            <Button type="submit" className="w-full" disabled={!isValid}>
              {t("createPasswordView.button.changePassword")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </FormProvider>
  );
}
