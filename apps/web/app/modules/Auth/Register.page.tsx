import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "@remix-run/react";
import { format, startOfDay, subYears } from "date-fns";
import { enUS, pl } from "date-fns/locale";
import { useEffect, useMemo } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useRegisterUser } from "~/api/mutations/useRegisterUser";
import { useGlobalSettings, useGlobalSettingsSuspense } from "~/api/queries/useGlobalSettings";
import { useSSOEnabled } from "~/api/queries/useSSOEnabled";
import { Icon } from "~/components/Icon";
import PasswordValidationDisplay from "~/components/PasswordValidation/PasswordValidationDisplay";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { FormValidationError } from "~/components/ui/form-validation-error";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { useToast } from "~/components/ui/use-toast";
import { cn } from "~/lib/utils";
import { detectBrowserLanguage, SUPPORTED_LANGUAGES } from "~/utils/browser-language";
import { setPageTitle } from "~/utils/setPageTitle";

import { SocialLogin } from "./components";
import { makeRegisterSchema } from "./schemas/register.schema";
import { parseBirthday } from "./utils/birthday";

import type { MetaFunction } from "@remix-run/react";
import type { RegisterBody } from "~/api/generated-api";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.register");

export default function RegisterPage() {
  const { mutate: registerUser } = useRegisterUser();
  const { t, i18n } = useTranslation();
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
    control,
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

  const maxBirthdayDate = useMemo(() => {
    const today = startOfDay(new Date());

    if (globalSettings?.ageLimit) return startOfDay(subYears(today, globalSettings.ageLimit));

    return today;
  }, [globalSettings?.ageLimit]);

  const calendarLocale = i18n.language.startsWith("pl") ? pl : enUS;

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
                  <Controller
                    control={control}
                    name="birthday"
                    render={({ field }) => {
                      const selectedDate = parseBirthday(field.value);

                      return (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              id="birthday"
                              type="button"
                              variant="outline"
                              className={cn(
                                "w-full flex items-center gap-3 font-normal bg-white shadow-sm border-neutral-200",
                                selectedDate
                                  ? "text-neutral-900 hover:text-neutral-900"
                                  : "text-neutral-500 hover:text-neutral-500",
                              )}
                            >
                              <Icon name="Calendar" className="size-4 text-neutral-500" />
                              <span className="grow text-left">
                                {selectedDate
                                  ? format(selectedDate, "PPP", { locale: calendarLocale })
                                  : t("registerView.field.birthdayPlaceholder")}
                              </span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-2" align="start">
                            <Calendar
                              variant="default"
                              mode="single"
                              selected={selectedDate ?? undefined}
                              onSelect={(date) => {
                                if (!date) return field.onChange("");

                                field.onChange(format(date, "yyyy-MM-dd"));
                              }}
                              disabled={(date) => date > maxBirthdayDate}
                              fromYear={maxBirthdayDate.getFullYear() - 120}
                              toYear={maxBirthdayDate.getFullYear()}
                              initialFocus
                              weekStartsOn={1}
                              locale={calendarLocale}
                            />
                          </PopoverContent>
                        </Popover>
                      );
                    }}
                  />
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
