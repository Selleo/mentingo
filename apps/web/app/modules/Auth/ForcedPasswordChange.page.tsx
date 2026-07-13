import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@remix-run/react";
import { LogOut } from "lucide-react";
import { FormProvider, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useChangePassword } from "~/api/mutations/useChangePassword";
import { useLogoutUser } from "~/api/mutations/useLogoutUser";
import PasswordValidationDisplay from "~/components/PasswordValidation/PasswordValidationDisplay";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { FormValidationError } from "~/components/ui/form-validation-error";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";
import { LOGIN_REDIRECT_URL } from "~/modules/Auth/constants";

import { forcedPasswordChangeSchema } from "./schemas/forcedPasswordChange.schema";

import type { ChangePasswordBody } from "~/api/generated-api";

export default function ForcedPasswordChangePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { mutateAsync: changePassword, isPending: isChangingPassword } = useChangePassword();
  const { mutate: logout, isPending: isLoggingOut } = useLogoutUser();

  const methods = useForm<ChangePasswordBody>({
    resolver: zodResolver(forcedPasswordChangeSchema),
    mode: "onChange",
    defaultValues: { oldPassword: "", newPassword: "", confirmPassword: "" },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = methods;

  const onSubmit = async (data: ChangePasswordBody) => {
    await changePassword({ data, hasPassword: true });
    navigate(LOGIN_REDIRECT_URL, { replace: true });
  };

  return (
    <FormProvider {...methods}>
      <Card className="mx-auto w-full max-w-md" data-testid="forced-password-change-page">
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardHeader>
            <CardTitle className="text-2xl">{t("forcedPasswordChangeView.header")}</CardTitle>
            <CardDescription>{t("forcedPasswordChangeView.subHeader")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="oldPassword">{t("changePasswordView.field.oldPassword")}</Label>
              <Input
                id="oldPassword"
                type="password"
                className={cn({ "border-red-500 focus:!ring-red-500": errors.oldPassword })}
                {...register("oldPassword")}
              />
              {errors.oldPassword?.message && (
                <FormValidationError message={t(errors.oldPassword.message)} />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">{t("changePasswordView.field.newPassword")}</Label>
              <Input
                id="newPassword"
                type="password"
                className={cn({ "border-red-500 focus:!ring-red-500": errors.newPassword })}
                {...register("newPassword")}
              />
              <Label htmlFor="confirmPassword">
                {t("changePasswordView.field.confirmPassword")}
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                className={cn({ "border-red-500 focus:!ring-red-500": errors.confirmPassword })}
                {...register("confirmPassword")}
              />
              {errors.confirmPassword?.message && (
                <FormValidationError message={t(errors.confirmPassword.message)} />
              )}
            </div>
            <PasswordValidationDisplay fieldName="newPassword" confirmFieldName="confirmPassword" />
          </CardContent>
          <CardFooter className="flex items-center gap-3 border-t px-6 py-4">
            <Button disabled={!isValid || isChangingPassword} type="submit" className="w-full">
              {t("forcedPasswordChangeView.submit")}
            </Button>
            <Button
              disabled={isLoggingOut}
              type="button"
              variant="outline"
              className="w-fit"
              onClick={() => logout()}
            >
              <LogOut className="size-4" />
            </Button>
          </CardFooter>
        </form>
      </Card>
    </FormProvider>
  );
}
