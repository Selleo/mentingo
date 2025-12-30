import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "@remix-run/react";
import { useEffect, useMemo } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useRegisterUser } from "~/api/mutations/useRegisterUser";
import { useGlobalSettings, useGlobalSettingsSuspense } from "~/api/queries/useGlobalSettings";
import { useSSOEnabled } from "~/api/queries/useSSOEnabled";
import PasswordValidationDisplay from "~/components/PasswordValidation/PasswordValidationDisplay";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { FormValidationError } from "~/components/ui/form-validation-error";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useToast } from "~/components/ui/use-toast";
import { detectBrowserLanguage, SUPPORTED_LANGUAGES } from "~/utils/browser-language";
import { setPageTitle } from "~/utils/setPageTitle";

import { SocialLogin } from "./components";
import { makeRegisterSchema } from "./schemas/register.schema";

import type { MetaFunction } from "@remix-run/react";
import type { RegisterBody } from "~/api/generated-api";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.register");

export default function RegisterPage() {
  const { mutate: registerUser } = useRegisterUser();
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();

  const { data: ssoEnabled } = useSSOEnabled();
  const { data: globalSettings } = useGlobalSettings();

  const isGoogleOAuthEnabled =
    (ssoEnabled?.data.google ?? import.meta.env.VITE_GOOGLE_OAUTH_ENABLED) === "true";

  const isMicrosoftOAuthEnabled =
    (ssoEnabled?.data.microsoft ?? import.meta.env.VITE_MICROSOFT_OAUTH_ENABLED) === "true";

  const isSlackOAuthEnabled =
    (ssoEnabled?.data.slack ?? import.meta.env.VITE_SLACK_OAUTH_ENABLED) === "true";

  const registerSchema = useMemo(
    () => makeRegisterSchema(t, globalSettings?.ageLimit ?? undefined),
    [globalSettings?.ageLimit, t],
  );

  const methods = useForm<RegisterBody & { birthday: string }>({
    resolver: zodResolver(registerSchema),
    mode: "onChange",
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      language: SUPPORTED_LANGUAGES.includes(detectBrowserLanguage())
        ? detectBrowserLanguage()
        : "en",
      birthday: "",
    },
  });

  const {
    data: {
      enforceSSO: isSSOEnforced,
      inviteOnlyRegistration: inviteOnlyRegistration,
      loginBackgroundImageS3Key,
    },
  } = useGlobalSettingsSuspense();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = methods;

  const isAnyProviderEnabled = useMemo(
    () => isGoogleOAuthEnabled || isMicrosoftOAuthEnabled || isSlackOAuthEnabled,
    [isGoogleOAuthEnabled, isMicrosoftOAuthEnabled, isSlackOAuthEnabled],
  );

  useEffect(() => {
    if (inviteOnlyRegistration) {
      toast({
        description: t("inviteOnlyRegistrationView.toast.registerRedirect"),
        variant: "destructive",
      });
      return navigate("/auth/login");
    }
    // intentional
    // eslint-disable-next-line
  }, [inviteOnlyRegistration, navigate, toast]);

  const onSubmit = async (data: RegisterBody & { birthday: string }) => {
    if (isSSOEnforced && isAnyProviderEnabled) return;

    /**
     * We need to remove birthday from register data because we don't process personal data
     */
    const { birthday: _birthday, ...registerData } = data;
    registerUser({ data: registerData });
  };

  return (
    <FormProvider {...methods}>
      {loginBackgroundImageS3Key && (
        <div
          className="absolute inset-0 -z-10"
          style={{
            backgroundImage: `url(${loginBackgroundImageS3Key}) `,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      )}
      <Card className="mx-auto max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">{t("registerView.header")}</CardTitle>
          <CardDescription>
            {isSSOEnforced ? t("registerView.subHeaderSSO") : t("registerView.subHeader")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isSSOEnforced && (
            <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="firstName">{t("registerView.field.firstName")}</Label>
                <Input id="firstName" type="text" placeholder="John" {...register("firstName")} />
                {errors.firstName?.message && (
                  <FormValidationError message={errors.firstName.message} />
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="lastName">{t("registerView.field.lastName")}</Label>
                <Input id="lastName" type="text" placeholder="Doe" {...register("lastName")} />
                {errors.lastName?.message && (
                  <FormValidationError message={errors.lastName.message} />
                )}
              </div>

              {globalSettings?.ageLimit && (
                <div className="grid gap-2">
                  <Label htmlFor="birthday">{t("registerView.field.birthday")}</Label>
                  <Input id="birthday" type="date" {...register("birthday")} />
                  {errors.birthday?.message && (
                    <FormValidationError message={errors.birthday.message} />
                  )}
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="email">{t("registerView.field.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  {...register("email")}
                />
                {errors.email?.message && <FormValidationError message={errors.email.message} />}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="password">{t("registerView.field.password")}</Label>
                <Input id="password" type="password" {...register("password")} />
                <PasswordValidationDisplay fieldName="password" />
              </div>

              <Button type="submit" className="w-full" disabled={!isValid}>
                {t("registerView.button.createAccount")}
              </Button>
            </form>
          )}

          {isAnyProviderEnabled && (
            <SocialLogin
              isSSOEnforced={isSSOEnforced}
              isGoogleOAuthEnabled={isGoogleOAuthEnabled}
              isMicrosoftOAuthEnabled={isMicrosoftOAuthEnabled}
              isSlackOAuthEnabled={isSlackOAuthEnabled}
            />
          )}

          <div className="mt-4 text-center text-sm">
            {t("registerView.other.alreadyHaveAccount")}{" "}
            <Link to="/auth/login" className="underline">
              {t("registerView.button.signIn")}
            </Link>
          </div>
        </CardContent>
      </Card>
    </FormProvider>
  );
}
