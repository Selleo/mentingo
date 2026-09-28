import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useRemovePhone } from "~/api/mutations/useRemovePhone";
import { useRequestPhoneAttachCode } from "~/api/mutations/useRequestPhoneAttachCode";
import { useVerifyPhoneAttach } from "~/api/mutations/useVerifyPhoneAttach";
import { useCurrentUserSuspense } from "~/api/queries/useCurrentUser";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { FormValidationError } from "~/components/ui/form-validation-error";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useCountdown } from "~/hooks/useCountdown";
import { cn } from "~/lib/utils";
import { PhoneCodeInput } from "~/modules/Auth/components/PhoneCodeInput";
import {
  getRetryAfterSeconds,
  otpCodeSchema,
  phoneRequestSchema,
  type PhoneRequestFormValues,
} from "~/modules/Auth/schemas/phoneAuth.schema";

import { SETTINGS_PAGE_HANDLES } from "../../../../../e2e/data/settings/handles";

export default function PhoneNumberForm() {
  const { t } = useTranslation();
  const { data: currentUser } = useCurrentUserSuspense();

  const [pendingPhone, setPendingPhone] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);

  const {
    remaining: resendIn,
    isRunning: isResendLocked,
    start: startCountdown,
    reset: resetCountdown,
  } = useCountdown();

  const { mutateAsync: requestCode, isPending: isRequestingCode } = useRequestPhoneAttachCode();
  const { mutateAsync: verifyPhone, isPending: isVerifying } = useVerifyPhoneAttach();
  const { mutate: removePhone, isPending: isRemoving } = useRemovePhone();

  const requestSchema = useMemo(() => phoneRequestSchema(t), [t]);
  const codeSchema = useMemo(() => otpCodeSchema(t), [t]);

  const {
    register,
    handleSubmit,
    reset: resetPhoneForm,
    formState: { errors },
  } = useForm<PhoneRequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: { phone: "" },
  });

  const sendCode = async (phone: string) => {
    try {
      const { resendAvailableInSeconds } = await requestCode({ phone });

      setPendingPhone(phone);
      setCode("");
      setCodeError(null);
      startCountdown(resendAvailableInSeconds);
    } catch (error) {
      const retryAfterSeconds = getRetryAfterSeconds(error);

      if (retryAfterSeconds !== null) startCountdown(retryAfterSeconds);
    }
  };

  const cancelVerification = () => {
    setPendingPhone(null);
    setCode("");
    setCodeError(null);
    resetCountdown();
  };

  const onVerify = async () => {
    if (!pendingPhone) return;

    const parsed = codeSchema.safeParse(code);

    if (!parsed.success) {
      setCodeError(parsed.error.issues[0]?.message ?? t("phoneAuth.validation.code"));
      return;
    }

    try {
      await verifyPhone({ phone: pendingPhone, code: parsed.data });
      cancelVerification();
      resetPhoneForm({ phone: "" });
    } catch {
      setCode("");
    }
  };

  if (currentUser.isSupportMode) return null;

  const hasPhone = Boolean(currentUser.phone);
  const isVerified = Boolean(currentUser.phoneVerifiedAt);

  return (
    <Card id="phone-number" data-testid={SETTINGS_PAGE_HANDLES.PHONE_CARD}>
      <CardHeader>
        <CardTitle className="h5">{t("phoneAuth.settings.header")}</CardTitle>
        <CardDescription className="body-lg-md">
          {t("phoneAuth.settings.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="body-base-md">{t("phoneAuth.settings.current")}:</span>
          {hasPhone ? (
            <>
              <span className="font-semibold">{currentUser.phone}</span>
              <Badge variant={isVerified ? "success" : "notStarted"}>
                {isVerified ? t("phoneAuth.status.verified") : t("phoneAuth.status.notVerified")}
              </Badge>
            </>
          ) : (
            <span className="text-neutral-500">{t("phoneAuth.settings.none")}</span>
          )}
        </div>

        {!pendingPhone && (
          <form
            className="space-y-2"
            onSubmit={handleSubmit(({ phone }) => sendCode(phone))}
            id="phone-number-request-form"
          >
            <Label htmlFor="settings-phone" className="body-base-md">
              {hasPhone ? t("phoneAuth.settings.newPhone") : t("phoneAuth.field.phone")}
            </Label>
            <Input
              id="settings-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder={t("phoneAuth.placeholder.phone")}
              data-testid={SETTINGS_PAGE_HANDLES.PHONE_INPUT}
              className={cn({ "border-red-500 focus:!ring-red-500": errors.phone })}
              {...register("phone")}
            />
            {errors.phone?.message && <FormValidationError message={errors.phone.message} />}
          </form>
        )}

        {pendingPhone && (
          <div className="space-y-2">
            <Label htmlFor="settings-phone-code" className="body-base-md">
              {t("phoneAuth.field.code")}
            </Label>
            <p className="text-sm text-neutral-500">
              {t("phoneAuth.description.codeSent", { phone: pendingPhone })}
            </p>
            <PhoneCodeInput
              id="settings-phone-code"
              testId={SETTINGS_PAGE_HANDLES.PHONE_CODE_INPUT}
              value={code}
              onChange={(value) => {
                setCode(value);
                setCodeError(null);
              }}
              disabled={isVerifying}
            />
            {codeError && <FormValidationError message={codeError} />}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2 border-t px-6 py-4">
        {!pendingPhone && (
          <Button
            type="submit"
            form="phone-number-request-form"
            disabled={isRequestingCode || isResendLocked}
            data-testid={SETTINGS_PAGE_HANDLES.PHONE_REQUEST_CODE}
          >
            {isResendLocked
              ? t("phoneAuth.button.resendIn", { seconds: resendIn })
              : t("phoneAuth.button.getCode")}
          </Button>
        )}
        {pendingPhone && (
          <>
            <Button
              type="button"
              onClick={onVerify}
              disabled={isVerifying}
              data-testid={SETTINGS_PAGE_HANDLES.PHONE_VERIFY}
            >
              {t("phoneAuth.button.verify")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => sendCode(pendingPhone)}
              disabled={isResendLocked || isRequestingCode}
              data-testid={SETTINGS_PAGE_HANDLES.PHONE_RESEND_CODE}
            >
              {isResendLocked
                ? t("phoneAuth.button.resendIn", { seconds: resendIn })
                : t("phoneAuth.button.resend")}
            </Button>
            <Button type="button" variant="ghost" onClick={cancelVerification}>
              {t("common.button.cancel")}
            </Button>
          </>
        )}
        {!pendingPhone && hasPhone && (
          <Button
            type="button"
            variant="outline"
            className="ml-auto"
            onClick={() => removePhone()}
            disabled={isRemoving}
            data-testid={SETTINGS_PAGE_HANDLES.PHONE_REMOVE}
          >
            {t("phoneAuth.button.remove")}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
