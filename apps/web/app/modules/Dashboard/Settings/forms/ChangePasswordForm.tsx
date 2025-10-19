import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

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
import { FormValidationError } from "~/components/ui/form-validation-error";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";

import { passwordSchema } from "../schema/password.schema";

import type { ChangePasswordBody } from "~/api/generated-api";

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, "changePasswordView.validation.oldPassword"),
  newPassword: passwordSchema,
});

export default function ChangePasswordForm() {
  const { mutate: changePassword } = useChangePassword();
  const { t } = useTranslation();

  const methods = useForm<ChangePasswordBody>({
    resolver: zodResolver(changePasswordSchema),
    mode: "onChange",
    defaultValues: {
      oldPassword: "",
      newPassword: "",
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = methods;

  const onSubmit = (data: ChangePasswordBody) => {
    changePassword({ data });
    reset();
  };

  return (
    <FormProvider {...methods}>
      <Card id="user-info">
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardHeader>
            <CardTitle className="h5">{t("changePasswordView.header")}</CardTitle>
            <CardDescription className="body-lg-md">
              {t("changePasswordView.subHeader")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="oldPassword" className="body-base-md">
              {t("changePasswordView.field.oldPassword")}
            </Label>
            <Input
              id="oldPassword"
              type="password"
              className={cn({
                "border-red-500 focus:!ring-red-500": errors.oldPassword,
              })}
              {...register("oldPassword")}
            />
            {errors.oldPassword?.message && (
              <FormValidationError message={t(errors.oldPassword.message)} />
            )}

            <div className="space-y-2">
              <Label htmlFor="newPassword" className="body-base-md">
                {t("changePasswordView.field.newPassword")}
              </Label>
              <Input
                id="newPassword"
                type="password"
                className={cn({
                  "border-red-500 focus:!ring-red-500": errors.newPassword,
                })}
                {...register("newPassword")}
              />

              <div id="password-hints" className="mb-3">
                <PasswordValidationDisplay fieldName="newPassword" />
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
            <Button disabled={!isValid} type="submit">
              {t("common.button.save")}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </FormProvider>
  );
}
