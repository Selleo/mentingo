import { InputOTP, InputOTPGroup, InputOTPSlot } from "~/components/ui/input-otp";

import { PHONE_OTP_CODE_LENGTH } from "../schemas/phoneAuth.schema";

type PhoneCodeInputProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  testId?: string;
};

export function PhoneCodeInput({
  id,
  value,
  onChange,
  onComplete,
  disabled,
  testId,
}: PhoneCodeInputProps) {
  return (
    <InputOTP
      id={id}
      name={id}
      maxLength={PHONE_OTP_CODE_LENGTH}
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="^\d*$"
      data-testid={testId}
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      disabled={disabled}
    >
      <InputOTPGroup className="flex">
        {Array.from({ length: PHONE_OTP_CODE_LENGTH }, (_, index) => (
          <InputOTPSlot index={index} key={index} />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}
