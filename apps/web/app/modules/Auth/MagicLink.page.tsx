import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "@remix-run/react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useCreateMagicLink } from "~/api/mutations/useCreateMagicLink";
import { useGlobalSettingsSuspense } from "~/api/queries/useGlobalSettings";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useToast } from "~/components/ui/use-toast";
import { cn } from "~/lib/utils";
import { setPageTitle } from "~/utils/setPageTitle";

import { magicLinkSchema } from "./schemas/magicLink.schema";

import type { MetaFunction } from "@remix-run/react";
import type { CreateMagicLinkBody } from "~/api/generated-api";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.magicLink");

export default function MagicLinkPage() {
  const { mutateAsync: createMagicLink, isPending } = useCreateMagicLink();
  const { toast } = useToast();
  const { t } = useTranslation();
  const {
    data: { loginBackgroundImageS3Key },
  } = useGlobalSettingsSuspense();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateMagicLinkBody>({
    resolver: zodResolver(magicLinkSchema(t)),
  });

  const onSubmit = (data: CreateMagicLinkBody) =>
    createMagicLink({ data }).then(() => {
      toast({
        description: t("magicLinkView.toast.sent"),
      });
      reset();
    });

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
              {t("magicLinkView.header")}
            </CardTitle>
            <CardDescription className="mt-2 text-center text-sm text-muted-foreground w-4/5 mx-auto pt-2">
              {t("magicLinkView.subHeader")}
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-1">
            <form className="space-y-6" action="#" onSubmit={handleSubmit(onSubmit)}>
              <div className="grid gap-2">
                <Label htmlFor="email">{t("magicLinkView.field.email")}</Label>
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
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? t("common.button.saving") : t("magicLinkView.button.sendLink")}
              </Button>
            </form>
            <div className="mt-8 flex justify-center">
              <Link to="/auth/login" className="text-sm font-medium text-muted-foreground">
                {t("magicLinkView.button.backToLogin")}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
