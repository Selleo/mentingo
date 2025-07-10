import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "@remix-run/react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { useRegisterUser } from "~/api/mutations/useRegisterUser";
import PasswordValidationDisplay from "~/components/PasswordValidation/PasswordValidationDisplay";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { validatePassword } from "~/modules/Dashboard/Settings/schema/password.schema";

import type { RegisterBody } from "~/api/generated-api";

const registerSchema = z.object({
  firstName: z.string().min(2, { message: "registerView.validation.firstName" }),
  lastName: z.string().min(2, { message: "registerView.validation.lastName" }),
  email: z.string().email({ message: "registerView.validation.email" }),
  password: z.string().refine((password) => validatePassword(password), {}),
});
export default function RegisterPage() {
  const { mutate: registerUser } = useRegisterUser();
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
    trigger,
  } = useForm<RegisterBody>({
    resolver: zodResolver(registerSchema),
    mode: "onChange",
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
    },
  });

  const passwordValue = watch("password", "");
  const firstNameValue = watch("firstName", "");
  const lastNameValue = watch("lastName", "");
  const emailValue = watch("email");

  const onSubmit = async (data: RegisterBody) => {
    registerUser({ data });
  };

  return (
    <Card className="mx-auto max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">{t("registerView.header")}</CardTitle>
        <CardDescription>{t("registerView.subHeader")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="firstName">{t("registerView.field.firstName")}</Label>
            <Input id="firstName" type="text" placeholder="John" {...register("firstName")} />
            {errors.firstName && (
              <div className="text-sm text-red-500">
                {t(errors.firstName.message ?? "registerView.validation.firstName")}
              </div>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="lastName">{t("registerView.field.lastName")}</Label>
            <Input id="lastName" type="text" placeholder="Doe" {...register("lastName")} />
            {errors.lastName && (
              <div className="text-sm text-red-500">
                {t(errors.lastName.message ?? "registerView.validation.lastName")}
              </div>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">{t("registerView.field.email")}</Label>
            <Input id="email" type="email" placeholder="user@example.com" {...register("email")} />
            {errors.email && (
              <div className="text-sm text-red-500">
                {t(errors.email.message ?? "registerView.validation.email")}
              </div>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">{t("registerView.field.password")}</Label>
            <Input
              id="password"
              type="password"
              {...register("password", {
                onBlur: () => trigger("password"),
              })}
            />
            <PasswordValidationDisplay password={passwordValue} />
            {errors.password && (
              <div className="text-sm text-red-500">
                {t(errors.password.message ?? "registerView.validation.password")}
              </div>
            )}
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={
              !isValid || !firstNameValue || !lastNameValue || !emailValue || !passwordValue
            }
          >
            {t("registerView.button.createAccount")}
          </Button>
        </form>
        <div className="mt-4 text-center text-sm">
          {t("registerView.other.alreadyHaveAccount")}{" "}
          <Link to="/auth/login" className="underline">
            {t("registerView.button.signIn")}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
