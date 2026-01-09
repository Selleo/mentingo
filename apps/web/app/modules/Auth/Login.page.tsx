import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useSearchParams } from "@remix-run/react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { version } from "~/../version.json";
import { useLoginUser } from "~/api/mutations/useLoginUser";
import { useGlobalSettingsSuspense } from "~/api/queries/useGlobalSettings";
import useLoginPageFiles from "~/api/queries/useLoginPageFiles";
import { useSSOEnabled } from "~/api/queries/useSSOEnabled";
import { FormCheckbox } from "~/components/Form/FormCheckbox";
import { PlatformLogo } from "~/components/PlatformLogo";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { toast } from "~/components/ui/use-toast";
import { cn } from "~/lib/utils";
import { UploadFilesToLoginPagePreviewDialog } from "~/modules/Dashboard/Settings/components/admin/UploadFilesToLoginPagePreviewDialog";
import { setPageTitle } from "~/utils/setPageTitle";

import { SocialLogin } from "./components";

import type { LoginPageResource } from "../Dashboard/Settings/components/admin/UploadFilesToLoginPageItem";
import type { MetaFunction } from "@remix-run/react";
import type { LoginBody } from "~/api/generated-api";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.login");

const loginSchema = (t: (key: string) => string) =>
  z.object({
    email: z.string().email({ message: t("loginView.validation.email") }),
    password: z.string().min(1, { message: t("loginView.validation.password") }),
    rememberMe: z.boolean().optional(),
  });

export default function LoginPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const error = searchParams.get("error");

  const { data: loginPageFiles } = useLoginPageFiles();

  const [previewResource, setPreviewResource] = useState<LoginPageResource | null>(null);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);

  useEffect(() => {
    if (error) {
      toast({
        variant: "destructive",
        description: error,
      });
      setSearchParams({});
    }
  }, [error, setSearchParams]);

  const { t } = useTranslation();

  const { data: ssoEnabled } = useSSOEnabled();

  const handlePreviewClick = (resource: LoginPageResource) => {
    setPreviewResource(resource);
    setIsPreviewDialogOpen(true);
  };

  const handleClosePreviewDialog = () => {
    setIsPreviewDialogOpen(false);
    setPreviewResource(null);
  };

  const isGoogleOAuthEnabled =
    (ssoEnabled?.data.google ?? import.meta.env.VITE_GOOGLE_OAUTH_ENABLED) === "true";

  const isMicrosoftOAuthEnabled =
    (ssoEnabled?.data.microsoft ?? import.meta.env.VITE_MICROSOFT_OAUTH_ENABLED) === "true";

  const isSlackOAuthEnabled =
    (ssoEnabled?.data.slack ?? import.meta.env.VITE_SLACK_OAUTH_ENABLED) === "true";

  const { mutateAsync: loginUser } = useLoginUser();

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
    formState: { errors },
  } = useForm<LoginBody>({ resolver: zodResolver(loginSchema(t)) });

  const isAnyProviderEnabled = useMemo(
    () => isGoogleOAuthEnabled || isMicrosoftOAuthEnabled || isSlackOAuthEnabled,
    [isGoogleOAuthEnabled, isMicrosoftOAuthEnabled, isSlackOAuthEnabled],
  );

  const loginResources = loginPageFiles?.resources ?? [];

  const onSubmit = (data: LoginBody) => {
    if (isSSOEnforced && isAnyProviderEnabled) return;

    loginUser({ data });
  };

  return (
    <>
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
          <CardTitle role="heading" className="text-2xl">
            <div className="mb-6 flex justify-center">
              <PlatformLogo className="h-16 w-auto py-3" alt="Platform Logo" />
            </div>
            {t("loginView.header")}
          </CardTitle>
          <CardDescription>
            {isSSOEnforced ? t("loginView.subHeaderSSO") : t("loginView.subHeader")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isSSOEnforced && (
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
                  <Link
                    to="/auth/password-recovery"
                    className="ml-auto inline-block text-sm underline"
                  >
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
          )}

          {isAnyProviderEnabled && (
            <SocialLogin
              isSSOEnforced={isSSOEnforced}
              isGoogleOAuthEnabled={isGoogleOAuthEnabled}
              isMicrosoftOAuthEnabled={isMicrosoftOAuthEnabled}
              isSlackOAuthEnabled={isSlackOAuthEnabled}
            />
          )}

          {!inviteOnlyRegistration && (
            <div className="mt-4 text-center text-sm">
              {t("loginView.other.dontHaveAccount")}{" "}
              <Link to="/auth/register" className="underline">
                {t("loginView.other.signUp")}
              </Link>
            </div>
          )}

          {loginResources.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-center text-sm text-neutral-400">
              {loginResources.map((resource, index) => (
                <div key={resource.id} className="flex items-center">
                  {index > 0 && loginResources.length > 1 && (
                    <Separator orientation="vertical" className="mx-2 h-4 bg-neutral-300" />
                  )}
                  <button
                    type="button"
                    onClick={() => handlePreviewClick(resource)}
                    className="text-sm truncate underline"
                  >
                    {resource.name}
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="bottom-4 mt-4 text-center text-sm text-neutral-300">
            {t("common.other.appVersion", { version })}
          </p>
        </CardContent>
      </Card>
      <UploadFilesToLoginPagePreviewDialog
        open={isPreviewDialogOpen}
        resourceName={previewResource?.name ?? t("loginFilesUpload.unnamedFile")}
        resourceUrl={previewResource?.resourceUrl ?? ""}
        onClose={handleClosePreviewDialog}
      />
    </>
  );
}
