import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "@remix-run/react";
import { format, startOfDay, subYears } from "date-fns";
import { enUS, pl } from "date-fns/locale";
import { useEffect, useMemo } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useRegisterUser } from "~/api/mutations/useRegisterUser";
import { useGlobalSettings, useGlobalSettingsSuspense } from "~/api/queries/useGlobalSettings";
import { useRegistrationForm } from "~/api/queries/useRegistrationForm";
import { useSSOEnabled } from "~/api/queries/useSSOEnabled";
import { Icon } from "~/components/Icon";
import PasswordValidationDisplay from "~/components/PasswordValidation/PasswordValidationDisplay";
import { PlatformLogo } from "~/components/PlatformLogo";
import Viewer from "~/components/RichText/Viever";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { FormValidationError } from "~/components/ui/form-validation-error";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { useToast } from "~/components/ui/use-toast";
import { cn } from "~/lib/utils";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { setPageTitle } from "~/utils/setPageTitle";

import { SocialLogin } from "./components";
import { makeRegisterSchema } from "./schemas/register.schema";
import { parseBirthday } from "./utils/birthday";

import type { MetaFunction } from "@remix-run/react";
import type { RegisterBody } from "~/api/generated-api";

type RegisterFormValues = RegisterBody & {
  birthday: string;
  formAnswers: Record<string, boolean>;
};

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.register");

export default function RegisterPage() {
  const { mutate: registerUser } = useRegisterUser();
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const selectedLanguage = useLanguageStore((state) => state.language);
  const { data: ssoEnabled } = useSSOEnabled();
  const { data: globalSettings } = useGlobalSettings();
  const { data: registrationForm } = useRegistrationForm(selectedLanguage);

  const isGoogleOAuthEnabled =
    (ssoEnabled?.data.google ?? import.meta.env.VITE_GOOGLE_OAUTH_ENABLED) === "true";

  const isMicrosoftOAuthEnabled =
    (ssoEnabled?.data.microsoft ?? import.meta.env.VITE_MICROSOFT_OAUTH_ENABLED) === "true";

  const isSlackOAuthEnabled =
    (ssoEnabled?.data.slack ?? import.meta.env.VITE_SLACK_OAUTH_ENABLED) === "true";

  const requiredFieldIds = useMemo(
    () => registrationForm?.fields.filter((field) => field.required).map((field) => field.id) ?? [],
    [registrationForm?.fields],
  );

  const registerSchema = useMemo(
    () => makeRegisterSchema(t, globalSettings?.ageLimit ?? undefined, requiredFieldIds),
    [globalSettings?.ageLimit, requiredFieldIds, t],
  );

  const methods = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      language: selectedLanguage,
      birthday: "",
      formAnswers: {},
    },
    mode: "onChange",
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
    reset,
    formState: { errors, isValid },
  } = methods;

  useEffect(() => {
    if (!registrationForm?.fields) return;

    const currentValues = methods.getValues();
    const nextFormAnswers = Object.fromEntries(
      registrationForm.fields.map((field) => [
        field.id,
        currentValues.formAnswers?.[field.id] ?? false,
      ]),
    );

    reset(
      {
        ...currentValues,
        formAnswers: nextFormAnswers,
      },
      {
        keepDirtyValues: true,
      },
    );
  }, [methods, registrationForm?.fields, reset]);

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

  const onSubmit = async (data: RegisterFormValues) => {
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
    <>
      {loginBackgroundImageS3Key && (
        <div
          className="fixed inset-0 -z-10"
          style={{
            backgroundImage: `url(${loginBackgroundImageS3Key}) `,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      )}
      <FormProvider {...methods}>
        <div className="relative min-h-screen flex items-center justify-center">
          <div className="flex items-start justify-center px-4 py-6">
            <Card className="w-full max-w-md">
              <CardHeader>
                <div className="mb-2 flex justify-center">
                  <PlatformLogo className="h-16 w-auto py-2" alt="Platform Logo" />
                </div>
                <CardTitle className="text-xl">{t("registerView.header")}</CardTitle>
                <CardDescription className="max-w-md text-sm leading-6">
                  {isSSOEnforced ? t("registerView.subHeaderSSO") : t("registerView.subHeader")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!isSSOEnforced && (
                  <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="firstName">{t("registerView.field.firstName")}</Label>
                      <Input
                        id="firstName"
                        type="text"
                        placeholder="John"
                        {...register("firstName")}
                      />
                      {errors.firstName?.message && (
                        <FormValidationError message={errors.firstName.message} />
                      )}
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="lastName">{t("registerView.field.lastName")}</Label>
                      <Input
                        id="lastName"
                        type="text"
                        placeholder="Doe"
                        {...register("lastName")}
                      />
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
                                    captionLayout="dropdown-buttons"
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
                      {errors.email?.message && (
                        <FormValidationError message={errors.email.message} />
                      )}
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="password">{t("registerView.field.password")}</Label>
                      <Input id="password" type="password" {...register("password")} />
                      <PasswordValidationDisplay fieldName="password" />
                    </div>

                    {registrationForm?.fields.length ? (
                      <div className="grid gap-2">
                        {registrationForm.fields.map((field) => {
                          const fieldError = errors.formAnswers?.[field.id]?.message;

                          return (
                            <div key={field.id} className="space-y-2">
                              <div className="flex items-start gap-3">
                                <Controller
                                  control={control}
                                  name={`formAnswers.${field.id}`}
                                  render={({ field: controllerField }) => (
                                    <div className="flex items-start gap-2">
                                      <Checkbox
                                        id={field.id}
                                        checked={Boolean(controllerField.value)}
                                        onCheckedChange={(checked) =>
                                          controllerField.onChange(Boolean(checked))
                                        }
                                        className="mt-1.5"
                                      />

                                      <div className="flex items-center gap-1 text-sm">
                                        <Viewer
                                          content={field.label}
                                          className="text-sm [&_article]:m-0"
                                        />
                                      </div>
                                      {field.required && (
                                        <span className="font-semibold leading-6 text-destructive">
                                          *
                                        </span>
                                      )}
                                    </div>
                                  )}
                                />
                              </div>
                              <FormValidationError message={fieldError} />
                            </div>
                          );
                        })}
                      </div>
                    ) : null}

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
          </div>
        </div>
      </FormProvider>
    </>
  );
}
