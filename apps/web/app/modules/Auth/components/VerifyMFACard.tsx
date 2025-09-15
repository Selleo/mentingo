import { zodResolver } from "@hookform/resolvers/zod/dist/zod.js";
import { useNavigate } from "@remix-run/react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { useVerifyMFA } from "~/api/mutations";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "~/components/ui/input-otp";
import { Label } from "~/components/ui/label";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";

const mfaSetupSchema = z.object({
  token: z.string().min(1),
});

export function VerifyMFACard() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const setHasVerifiedMFA = useCurrentUserStore((state) => state.setHasVerifiedMFA);

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
        <CardTitle>{t("mfa.verify.title")}</CardTitle>
        <CardDescription>{t("mfa.verify.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <ol className="mb-4 list-inside list-decimal space-y-1">
          <li>{t("mfa.verify.openAuthenticator")}</li>
          <li>{t("mfa.verify.enterCode")}</li>
          <li>{t("mfa.verify.verifyToken")}</li>
        </ol>
        <form onSubmit={handleSubmit(onSubmit)} className="flex w-full flex-col items-center">
          <Label htmlFor="token" className="mb-1 block">
            {t("mfa.verify.tokenLabel")}
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
            {t("mfa.verify.verifyToken")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
