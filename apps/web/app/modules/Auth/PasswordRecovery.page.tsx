import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "@remix-run/react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { usePasswordRecovery } from "~/api/mutations/useRecoverPassword";
import { useGlobalSettingsSuspense } from "~/api/queries/useGlobalSettings";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useToast } from "~/components/ui/use-toast";
import { cn } from "~/lib/utils";

import type { ParentRouteData } from "../layout";
import type { MetaFunction } from "@remix-run/react";
import type { ForgotPasswordBody } from "~/api/generated-api";

export const meta: MetaFunction = ({ matches }) => {
  const parentMatch = matches.find((match) => match.id.includes("layout"));
  const companyShortName = (parentMatch?.data as ParentRouteData)?.companyInfo?.data
    ?.companyShortName;
  const title = companyShortName ? `${companyShortName} - Password Recovery` : "Password Recovery";

  return [{ title }];
};

const passwordRecoverySchema = (t: (key: string) => string) =>
  z.object({
    email: z.string().email({ message: t("forgotPasswordView.validation.email") }),
  });

export default function PasswordRecoveryPage() {
  const { mutateAsync: recoverPassword } = usePasswordRecovery();
  const { toast } = useToast();
  const { t } = useTranslation();
  const {
    data: { loginBackgroundImageS3Key },
  } = useGlobalSettingsSuspense();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordBody>({
    resolver: zodResolver(passwordRecoverySchema(t)),
  });

  const onSubmit = (data: ForgotPasswordBody) => {
    recoverPassword({ data }).then(() => {
      toast({
        description: t("forgotPasswordView.toast.resetPassword"),
      });
    });
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
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <Card className="mx-auto w-full max-w-md">
          <CardHeader>
            <CardTitle className="mt-6 text-center text-3xl font-bold tracking-tight">
              {t("forgotPasswordView.header")}
            </CardTitle>
            <CardDescription className="mt-2 text-center text-sm text-muted-foreground">
              {t("forgotPasswordView.subHeader")}
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-3">
            <form className="space-y-6" action="#" onSubmit={handleSubmit(onSubmit)}>
              <div className="grid gap-2">
                <Label htmlFor="email">{t("forgotPasswordView.field.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="user@example.com"
                  className={cn({ "border-red-500": errors.email })}
                  {...register("email")}
                />
                {errors.email && <div className="text-sm text-red-500">{errors.email.message}</div>}
              </div>
              <Button type="submit" className="w-full">
                {t("forgotPasswordView.button.resetPassword")}
              </Button>
            </form>
            <div className="mt-8 flex justify-center">
              <Link to="/auth/login" className="text-sm font-medium text-muted-foreground">
                {t("forgotPasswordView.button.backToLogin")}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
