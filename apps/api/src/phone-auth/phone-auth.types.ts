import type { PHONE_OTP_PURPOSE } from "./phone-auth.constants";

export type PhoneOtpPurpose = (typeof PHONE_OTP_PURPOSE)[keyof typeof PHONE_OTP_PURPOSE];

export type PhoneOtpContext = {
  tenantId: string;
  purpose: PhoneOtpPurpose;
  /** E.164 phone number */
  phone: string;
  /** Optional subject the code is bound to (e.g. the user attaching a phone). */
  subjectId?: string;
};

export type PhoneAuthConfig = {
  enabled: boolean;
  isProduction: boolean;
  smsRuApiId?: string;
  smsSender?: string;
  otpSecret: string;
};

export type SmsMessage = {
  /** E.164 phone number */
  to: string;
  text: string;
};

export type SmsSendResult = {
  providerMessageId?: string;
};

export interface SmsProvider {
  readonly name: string;
  send(message: SmsMessage): Promise<SmsSendResult>;
}

export type SmsRuNumberResult = {
  status?: string;
  status_code?: number;
  status_text?: string;
  sms_id?: string;
};

export type SmsRuSendResponse = {
  status?: string;
  status_code?: number;
  status_text?: string;
  balance?: number;
  sms?: Record<string, SmsRuNumberResult>;
};
