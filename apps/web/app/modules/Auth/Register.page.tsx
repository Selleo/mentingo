import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "@remix-run/react";
import { useEffect, useMemo, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

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

import { passwordSchema } from "../Dashboard/Settings/schema/password.schema";

import { SocialLogin } from "./components";

import type { MetaFunction } from "@remix-run/react";
import type { RegisterBody } from "~/api/generated-api";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.register");

const registerSchema = z.object({
  firstName: z.string().min(2, { message: "registerView.validation.firstName" }),
  lastName: z.string().min(2, { message: "registerView.validation.lastName" }),
  email: z.string().email({ message: "registerView.validation.email" }),
  password: passwordSchema,
  language: z.enum([...SUPPORTED_LANGUAGES] as [string, ...string[]]),
  birthday: z.string().optional(),
});

export default function RegisterPage() {
  const { mutate: registerUser } = useRegisterUser();
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();

  const { data: ssoEnabled } = useSSOEnabled();
  const { data: globalSettings } = useGlobalSettings();

  const [ageValidationError, setAgeValidationError] = useState<string | null>(null);

  const isGoogleOAuthEnabled =
    (ssoEnabled?.data.google ?? import.meta.env.VITE_GOOGLE_OAUTH_ENABLED) === "true";

  const isMicrosoftOAuthEnabled =
    (ssoEnabled?.data.microsoft ?? import.meta.env.VITE_MICROSOFT_OAUTH_ENABLED) === "true";

  const isSlackOAuthEnabled =
    (ssoEnabled?.data.slack ?? import.meta.env.VITE_SLACK_OAUTH_ENABLED) === "true";

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
    watch,
  } = methods;

  const birthdayValue = watch("birthday");

  const calculateAge = (birthday: string) => {
    const birthDate = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  };

  useEffect(() => {
    if (globalSettings?.ageLimit && birthdayValue) {
      const age = calculateAge(birthdayValue);
      if (age < globalSettings.ageLimit) {
        setAgeValidationError(
          t(`registerView.validation.birthday`, { ageLimit: globalSettings.ageLimit }),
        );
      } else {
        setAgeValidationError(null);
      }
    } else {
      setAgeValidationError(null);
    }
  }, [birthdayValue, globalSettings?.ageLimit, t]);

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

    if (globalSettings?.ageLimit && data.birthday) {
      const age = calculateAge(data.birthday);
      if (age < globalSettings.ageLimit) {
        toast({
          description: t("registerView.validation.birthday", { ageLimit: globalSettings.ageLimit }),
          variant: "destructive",
        });
        return;
      }
    }

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
                  <FormValidationError message={t(errors.firstName.message)} />
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="lastName">{t("registerView.field.lastName")}</Label>
                <Input id="lastName" type="text" placeholder="Doe" {...register("lastName")} />
                {errors.lastName?.message && (
                  <FormValidationError message={t(errors.lastName.message)} />
                )}
              </div>

              {globalSettings?.ageLimit && (
                <div className="grid gap-2">
                  <Label htmlFor="birthday">{t("registerView.field.birthday")}</Label>
                  <Input id="birthday" type="date" {...register("birthday")} />
                  {ageValidationError && <FormValidationError message={ageValidationError} />}
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
                {errors.email?.message && <FormValidationError message={t(errors.email.message)} />}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="password">{t("registerView.field.password")}</Label>
                <Input id="password" type="password" {...register("password")} />
                <PasswordValidationDisplay fieldName="password" />
              </div>

              <Button type="submit" className="w-full" disabled={!isValid || !!ageValidationError}>
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
