import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { usePhoneLoginRequestCode } from "~/api/mutations/usePhoneLoginRequestCode";
import { usePhoneLoginVerify } from "~/api/mutations/usePhoneLoginVerify";
import { FormCheckbox } from "~/components/Form/FormCheckbox";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useCountdown } from "~/hooks/useCountdown";
import { cn } from "~/lib/utils";

import { PHONE_LOGIN_HANDLES } from "../../../../e2e/data/auth/handles";
import {
  getRetryAfterSeconds,
  phoneRequestSchema,
  phoneVerifySchema,
  type PhoneRequestFormValues,
  type PhoneVerifyFormValues,
} from "../schemas/phoneAuth.schema";

import { PhoneCodeInput } from "./PhoneCodeInput";

type PhoneLoginStep = "phone" | "code";

export function PhoneLoginForm() {
  const { t } = useTranslation();

  const [step, setStep] = useState<PhoneLoginStep>("phone");
  const [phone, setPhone] = useState("");

  const {
    remaining: resendIn,
    isRunning: isResendLocked,
    start: startCountdown,
    reset: resetCountdown,
  } = useCountdown();

  const { mutateAsync: requestCode, isPending: isRequestingCode } = usePhoneLoginRequestCode();
  const { mutate: verifyCode, isPending: isVerifying } = usePhoneLoginVerify();

  const requestSchema = useMemo(() => phoneRequestSchema(t), [t]);
  const verifySchema = useMemo(() => phoneVerifySchema(t), [t]);

  const {
    register,
    handleSubmit: handleRequestSubmit,
    formState: { errors: requestErrors },
  } = useForm<PhoneRequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: { phone: "" },
  });

  const {
    control,
    handleSubmit: handleVerifySubmit,
    setValue,
    watch,
    reset: resetVerifyForm,
    formState: { errors: verifyErrors },
  } = useForm<PhoneVerifyFormValues>({
    resolver: zodResolver(verifySchema),
    defaultValues: { code: "", rememberMe: false },
  });

  const sendCode = async (phoneNumber: string) => {
    try {
      const { resendAvailableInSeconds } = await requestCode({ phone: phoneNumber });

      setPhone(phoneNumber);
      setStep("code");
      resetVerifyForm({ code: "", rememberMe: watch("rememberMe") });
      startCountdown(resendAvailableInSeconds);
    } catch (error) {
      const retryAfterSeconds = getRetryAfterSeconds(error);

      if (retryAfterSeconds !== null) startCountdown(retryAfterSeconds);
    }
  };

  const onRequestCode = ({ phone: phoneNumber }: PhoneRequestFormValues) => sendCode(phoneNumber);

  const onVerify = ({ code, rememberMe }: PhoneVerifyFormValues) => {
    verifyCode({ phone, code, rememberMe });
  };

  if (step === "phone") {
    return (
      <form className="grid gap-4" onSubmit={handleRequestSubmit(onRequestCode)}>
        <div className="grid gap-2">
          <Label htmlFor="phone">{t("phoneAuth.field.phone")}</Label>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder={t("phoneAuth.placeholder.phone")}
            data-testid={PHONE_LOGIN_HANDLES.PHONE_INPUT}
            className={cn({ "border-red-500": requestErrors.phone })}
            {...register("phone")}
          />
          {requestErrors.phone && (
            <div className="text-sm text-red-500">{requestErrors.phone.message}</div>
          )}
          <p className="text-sm text-neutral-500">{t("phoneAuth.description.enterPhone")}</p>
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={isRequestingCode || isResendLocked}
          data-testid={PHONE_LOGIN_HANDLES.REQUEST_CODE}
        >
          {isResendLocked
            ? t("phoneAuth.button.resendIn", { seconds: resendIn })
            : t("phoneAuth.button.getCode")}
        </Button>
      </form>
    );
  }

  return (
    <form className="grid gap-4" onSubmit={handleVerifySubmit(onVerify)}>
      <div className="grid gap-2">
        <Label htmlFor="phone-code">{t("phoneAuth.field.code")}</Label>
        <p className="text-sm text-neutral-500">{t("phoneAuth.description.codeSent", { phone })}</p>
        <PhoneCodeInput
          id="phone-code"
          testId={PHONE_LOGIN_HANDLES.CODE_INPUT}
          value={watch("code")}
          onChange={(value) => setValue("code", value, { shouldValidate: value.length === 6 })}
          disabled={isVerifying}
        />
        {verifyErrors.code && (
          <div className="text-sm text-red-500">{verifyErrors.code.message}</div>
        )}
      </div>
      <FormCheckbox control={control} name="rememberMe" label={t("loginView.other.rememberMe")} />
      <Button
        type="submit"
        className="w-full"
        disabled={isVerifying}
        data-testid={PHONE_LOGIN_HANDLES.SUBMIT}
      >
        {t("phoneAuth.button.signIn")}
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <button
          type="button"
          className="underline"
          data-testid={PHONE_LOGIN_HANDLES.CHANGE_PHONE}
          onClick={() => {
            setStep("phone");
            resetCountdown();
          }}
        >
          {t("phoneAuth.button.changePhone")}
        </button>
        <button
          type="button"
          className="underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60"
          disabled={isResendLocked || isRequestingCode}
          data-testid={PHONE_LOGIN_HANDLES.RESEND_CODE}
          onClick={() => sendCode(phone)}
        >
          {isResendLocked
            ? t("phoneAuth.button.resendIn", { seconds: resendIn })
            : t("phoneAuth.button.resend")}
        </button>
      </div>
    </form>
  );
}
