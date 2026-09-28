import {
  SMSRU_ERROR_DESCRIPTIONS,
  SMSRU_REQUEST_TIMEOUT_MS,
  SMSRU_SEND_URL,
  SMSRU_SUCCESS_STATUS_CODE,
} from "../phone-auth.constants";
import { toSmsRuRecipient } from "../phone.utils";

import { SmsSendError } from "./sms-send.error";

import type {
  SmsMessage,
  SmsProvider,
  SmsRuSendResponse,
  SmsSendResult,
} from "../phone-auth.types";

const PROVIDER_NAME = "sms.ru";

const describeSmsRuError = (statusCode: number | undefined, statusText: string | undefined) => {
  const known = statusCode !== undefined ? SMSRU_ERROR_DESCRIPTIONS[statusCode] : undefined;
  const description = known ?? statusText ?? "Unknown SMS.RU error";

  return `SMS.RU error ${statusCode ?? "?"}: ${description}`;
};

/**
 * Parses an SMS.RU `/sms/send?json=1` response for a single recipient.
 * Success requires both the request-level and the per-number status to be OK / 100.
 */
export const parseSmsRuSendResponse = (
  payload: unknown,
  recipient: string,
): SmsSendResult & { balance?: number } => {
  if (!payload || typeof payload !== "object") {
    throw new SmsSendError("SMS.RU returned an unexpected response", PROVIDER_NAME);
  }

  const response = payload as SmsRuSendResponse;

  if (response.status !== "OK" || response.status_code !== SMSRU_SUCCESS_STATUS_CODE) {
    throw new SmsSendError(
      describeSmsRuError(response.status_code, response.status_text),
      PROVIDER_NAME,
      response.status_code,
    );
  }

  const numberResult = response.sms?.[recipient];

  if (!numberResult) {
    throw new SmsSendError("SMS.RU response has no result for the recipient", PROVIDER_NAME);
  }

  if (numberResult.status !== "OK" || numberResult.status_code !== SMSRU_SUCCESS_STATUS_CODE) {
    throw new SmsSendError(
      describeSmsRuError(numberResult.status_code, numberResult.status_text),
      PROVIDER_NAME,
      numberResult.status_code,
    );
  }

  return { providerMessageId: numberResult.sms_id, balance: response.balance };
};

export class SmsRuProvider implements SmsProvider {
  readonly name = PROVIDER_NAME;

  constructor(
    private readonly apiId: string,
    private readonly sender?: string,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {
    if (!apiId) throw new Error("SMSRU_API_ID is required for SmsRuProvider");
  }

  async send({ to, text }: SmsMessage): Promise<SmsSendResult> {
    const recipient = toSmsRuRecipient(to);

    // Parameters go in the POST body (not the query string) so neither the api_id
    // nor the one-time code end up in proxy/access logs.
    const body = new URLSearchParams({
      api_id: this.apiId,
      to: recipient,
      msg: text,
      json: "1",
    });

    if (this.sender) body.set("from", this.sender);

    let response: Response;

    try {
      response = await this.fetchImpl(SMSRU_SEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: AbortSignal.timeout(SMSRU_REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new SmsSendError(
        `SMS.RU request failed: ${(error as Error)?.name ?? "Error"}`,
        PROVIDER_NAME,
      );
    }

    if (!response.ok) {
      throw new SmsSendError(`SMS.RU HTTP ${response.status}`, PROVIDER_NAME);
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      throw new SmsSendError("SMS.RU returned invalid JSON", PROVIDER_NAME);
    }

    const { providerMessageId } = parseSmsRuSendResponse(payload, recipient);

    return { providerMessageId };
  }
}
