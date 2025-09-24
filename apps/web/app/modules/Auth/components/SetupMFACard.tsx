import { zodResolver } from "@hookform/resolvers/zod/dist/zod.js";
import { useNavigate } from "@remix-run/react";
import { QRCodeSVG } from "qrcode.react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { useVerifyMFA, useSetupMFA } from "~/api/mutations";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "~/components/ui/input-otp";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";

const mfaSetupSchema = z.object({
  token: z.string().min(1),
});

export function SetupMFACard() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const setHasVerifiedMFA = useCurrentUserStore((state) => state.setHasVerifiedMFA);

  const { data: enableMFAData, isPending: isSettingUpMFA } = useSetupMFA();
  const { isPending: isVerifyingMFA, mutate: verifyMFA } = useVerifyMFA();

  const { handleSubmit, setValue, watch } = useForm<z.infer<typeof mfaSetupSchema>>({
    resolver: zodResolver(mfaSetupSchema),
    defaultValues: { token: "" },
  });

  const onSubmit = (data: z.infer<typeof mfaSetupSchema>) => {
    verifyMFA(data.token, {
      onSuccess: () => {
        setHasVerifiedMFA(true);
        navigate("/");
      },
    });
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="my-2 text-center">
        <CardTitle>{t("mfa.setup.title")}</CardTitle>
        <CardDescription>{t("mfa.setup.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <ol className="mb-4 list-inside list-decimal space-y-1">
          <li>{t("mfa.setup.scanQr")}</li>
          <li>{t("mfa.setup.manualEntry")}</li>
          <li>{t("mfa.setup.enterCode")}</li>
        </ol>

        {isSettingUpMFA ? (
          <Skeleton className="mt-4 size-48" aria-label={t("mfa.setup.loadingQr")} />
        ) : (
          <div className="mt-4 flex flex-col items-center">
            <QRCodeSVG value={enableMFAData?.data.otpauth ?? ""} className="size-44" />
            <div className="mt-2 text-sm">
              {t("mfa.setup.secretLabel")}:{" "}
              <span className="font-mono">{enableMFAData?.data.secret ?? ""}</span>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="border-t pt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="flex w-full flex-col items-center">
          <Label htmlFor="token" className="mb-1 block">
            {t("mfa.setup.tokenLabel")}
          </Label>
          <InputOTP
            id="token"
            name="token"
            maxLength={6}
            value={watch("token")}
            onChange={(newValue: string) => setValue("token", newValue)}
          >
            <InputOTPGroup className="flex">
              {Array.from({ length: 6 }, (_, idx) => (
                <InputOTPSlot index={idx} key={idx} />
              ))}
            </InputOTPGroup>
          </InputOTP>
          <Button variant="primary" className="mt-4" disabled={isVerifyingMFA}>
            {t("mfa.setup.verifyButton")}
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
