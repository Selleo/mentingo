import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useSearchParams } from "@remix-run/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { useCreateNewPassword } from "~/api/mutations/useCreateNewPassword";
import PasswordValidationDisplay from "~/components/PasswordValidation/PasswordValidationDisplay";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useToast } from "~/components/ui/use-toast";
import { cn } from "~/lib/utils";
import { validatePassword } from "~/modules/Dashboard/Settings/schema/password.schema";

import type { ResetPasswordBody } from "~/api/generated-api";

const createNewPasswordSchema = (t: (key: string) => string) =>
  z
    .object({
      newPassword: z.string().refine((password) => validatePassword(password), {}),
      newPasswordConfirmation: z.string(),
    })
    .refine(({ newPassword, newPasswordConfirmation }) => newPassword === newPasswordConfirmation, {
      message: t("createPasswordView.validation.passwordsDontMatch"),
      path: ["newPasswordConfirmation"],
    });

export default function CreateNewPasswordPage() {
  const [searchParams] = useSearchParams();
  const [isPasswordValid, setIsPasswordValid] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();
  const resetToken = searchParams.get("resetToken");
  const createToken = searchParams.get("createToken");
  const email = searchParams.get("email");
  const { mutateAsync: createNewPassword } = useCreateNewPassword({
    isCreate: !resetToken,
  });
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordBody & { newPasswordConfirmation: string }>({
    resolver: zodResolver(createNewPasswordSchema(t)),
    mode: "onChange",
  });

  const newPassworValue = watch("newPassword") || "";

  const onSubmit = (data: ResetPasswordBody) => {
    if (resetToken) {
      createNewPassword({
        data: { newPassword: data.newPassword, resetToken: resetToken },
      }).then(() => {
        toast({
          description: t("changePasswordView.toast.passwordChangedSuccessfully"),
        });
        navigate("/auth/login");
      });
    }

    if (createToken) {
      createNewPassword({
        data: { password: data.newPassword, createToken: createToken },
      }).then(() => {
        toast({
          description: t("changePasswordView.toast.passwordCreatedsuccessfuly"),
        });
        navigate("/auth/login");
      });
    }
  };

  return (
    <Card className="mx-auto max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">{t("createPasswordView.header")}</CardTitle>
        <CardDescription>
          {t("createPasswordView.subHeader")} {email}
        </CardDescription>
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

            {errors.newPassword && (
              <div className="text-sm text-red-500">{errors.newPassword.message}</div>
            )}
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
          <PasswordValidationDisplay
            password={newPassworValue}
            onValidationChange={setIsPasswordValid}
          />
          <Button
            type="submit"
            className={cn(
              "w-full cursor-default",
              !isPasswordValid ||
                !!errors.newPasswordConfirmation ||
                (!watch("newPasswordConfirmation") &&
                  "opacity-50 hover:bg-primary hover:opacity-50"),
            )}
            disabled={
              !isPasswordValid ||
              !!errors.newPasswordConfirmation ||
              !watch("newPasswordConfirmation")
            }
          >
            {t("createPasswordView.button.changePassword")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
