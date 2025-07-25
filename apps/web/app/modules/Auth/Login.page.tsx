import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "@remix-run/react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { useLoginUser } from "~/api/mutations/useLoginUser";
import LogoUrl from "~/assets/menitngo_logo_light_transparent.svg";
import { FormCheckbox } from "~/components/Form/FormCheckbox";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";

import { SocialLogin } from "./components";

import type { LoginBody } from "~/api/generated-api";

const loginSchema = (t: (key: string) => string) =>
  z.object({
    email: z.string().email({ message: t("loginView.validation.email") }),
    password: z.string().min(1, { message: t("loginView.validation.password") }),
    rememberMe: z.boolean().optional(),
  });

const isGoogleOAuthEnabled = import.meta.env.VITE_GOOGLE_OAUTH_ENABLED === "true";
const isMicrosoftOAuthEnabled = import.meta.env.VITE_MICROSOFT_OAUTH_ENABLED === "true";

export default function LoginPage() {
  const navigate = useNavigate();
  const { mutateAsync: loginUser } = useLoginUser();
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<LoginBody>({ resolver: zodResolver(loginSchema(t)) });

  const onSubmit = (data: LoginBody) => {
    loginUser({ data }).then(() => {
      navigate("/");
    });
  };

  return (
    <Card className="mx-auto max-w-sm">
      <CardHeader>
        <CardTitle role="heading" className="text-2xl">
          <img src={LogoUrl} alt="" loading="eager" decoding="async" />
          {t("loginView.header")}
        </CardTitle>
        <CardDescription>{t("loginView.subHeader")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-2">
            <Label htmlFor="email">{t("loginView.field.email")}</Label>
            <Input
              id="email"
              type="email"
              placeholder="user@example.com"
              className={cn({ "border-red-500": errors.email })}
              {...register("email")}
            />
            {errors.email && <div className="text-sm text-red-500">{errors.email.message}</div>}
          </div>
          <div className="grid gap-2">
            <div className="flex items-center">
              <Label htmlFor="password">{t("loginView.field.password")}</Label>
              <Link to="/auth/password-recovery" className="ml-auto inline-block text-sm underline">
                {t("loginView.other.forgotPassword")}
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              className={cn({ "border-red-500": errors.password })}
              {...register("password")}
            />
            {errors.password && (
              <div className="text-sm text-red-500">{errors.password.message}</div>
            )}
          </div>
          <FormCheckbox
            control={control}
            name="rememberMe"
            label={t("loginView.other.rememberMe")}
          />
          <Button type="submit" className="w-full">
            {t("loginView.button.login")}
          </Button>
        </form>

        {(isGoogleOAuthEnabled || isMicrosoftOAuthEnabled) && (
          <SocialLogin
            isGoogleOAuthEnabled={isGoogleOAuthEnabled}
            isMicrosoftOAuthEnabled={isMicrosoftOAuthEnabled}
          />
        )}

        <div className="mt-4 text-center text-sm">
          {t("loginView.other.dontHaveAccount")}{" "}
          <Link to="/auth/register" className="underline">
            {t("loginView.other.signUp")}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
