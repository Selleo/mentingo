import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useChangePassword } from "~/api/mutations/useChangePassword";
import PasswordValidationDisplay from "~/components/PasswordValidation/PasswordValidationDisplay";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";

import { passwordSchema } from "../schema/password.schema";

import type { ChangePasswordBody } from "~/api/generated-api";

export default function ChangePasswordForm() {
  const { mutate: changePassword } = useChangePassword();
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ChangePasswordBody>({
    resolver: zodResolver(passwordSchema),
  });

  const newPasswordValue = watch("newPassword", "");
  const oldPasswordValue = watch("oldPassword", "");
  console.log(`Old Password: ${oldPasswordValue}`);
  const { t } = useTranslation();

  const onSubmit = (data: ChangePasswordBody) => {
    changePassword({ data });
  };

  return (
    <Card id="user-info">
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardHeader>
          <CardTitle>{t("changePasswordView.header")}</CardTitle>
          <CardDescription>{t("changePasswordView.subHeader")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="oldPassword">{t("changePasswordView.field.oldPassword")}</Label>
          <Input
            id="oldPassword"
            type="password"
            className={cn({
              "border-red-500 focus:!ring-red-500": errors.oldPassword,
            })}
            {...register("oldPassword", {
              required: t("changePasswordView.validation.oldPassword"),
            })}
          />
          {errors.oldPassword && (
            <p className="mt-1 text-xs text-red-500">{errors.oldPassword.message}</p>
          )}

          <div className="space-y-2">
            <Label htmlFor="newPassword">{t("changePasswordView.field.newPassword")}</Label>
            <Input
              id="newPassword"
              type="password"
              className={cn({
                "border-red-500 focus:!ring-red-500": errors.newPassword,
              })}
              {...register("newPassword", {
                required: t("changePasswordView.validation.newPassword"),
              })}
            />

            <div id="password-hints" className="mb-3">
              <PasswordValidationDisplay
                password={newPasswordValue}
                onValidationChange={setIsPasswordValid}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t px-6 py-4">
          <Button
            disabled={!isPasswordValid || !newPasswordValue || !oldPasswordValue}
            type="submit"
          >
            {t("common.button.save")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
