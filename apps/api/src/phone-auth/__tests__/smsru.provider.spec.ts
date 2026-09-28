import { SMSRU_SEND_URL } from "src/phone-auth/phone-auth.constants";
import { SmsSendError } from "src/phone-auth/sms/sms-send.error";
import { parseSmsRuSendResponse, SmsRuProvider } from "src/phone-auth/sms/smsru.provider";

const RECIPIENT = "79161234567";

const okResponse = {
  status: "OK",
  status_code: 100,
  balance: 42.5,
  sms: {
    [RECIPIENT]: { status: "OK", status_code: 100, sms_id: "000000-10000000" },
  },
};

const jsonResponse = (body: unknown, init: { ok?: boolean; status?: number } = {}) =>
  ({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  }) as unknown as Response;

describe("parseSmsRuSendResponse", () => {
  it("returns the sms id on success", () => {
    expect(parseSmsRuSendResponse(okResponse, RECIPIENT)).toEqual({
      providerMessageId: "000000-10000000",
      balance: 42.5,
    });
  });

  it.each([
    [102, "Invalid api_id"],
    [103, "Insufficient funds"],
    [150, "SMS.RU system error"],
  ])("maps request-level error %p", (statusCode, description) => {
    const response = { status: "ERROR", status_code: statusCode, status_text: "raw" };

    try {
      parseSmsRuSendResponse(response, RECIPIENT);
      throw new Error("Expected parse to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(SmsSendError);
      expect((error as SmsSendError).providerCode).toBe(statusCode);
      expect((error as SmsSendError).message).toContain(description);
    }
  });

  it.each([
    [104, "Invalid recipient number"],
    [105, "Invalid sender name"],
    [107, "Recipient number is not allowed"],
    [110, "Duplicate message"],
    [112, "Daily limit for this number reached"],
    [113, "Blocked by moderator"],
  ])("maps per-number error %p", (statusCode, description) => {
    const response = {
      status: "OK",
      status_code: 100,
      sms: { [RECIPIENT]: { status: "ERROR", status_code: statusCode, status_text: "raw" } },
    };

    try {
      parseSmsRuSendResponse(response, RECIPIENT);
      throw new Error("Expected parse to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(SmsSendError);
      expect((error as SmsSendError).providerCode).toBe(statusCode);
      expect((error as SmsSendError).message).toContain(description);
    }
  });

  it("uses the provider status text for unknown codes", () => {
    const response = { status: "ERROR", status_code: 999, status_text: "Something new" };

    expect(() => parseSmsRuSendResponse(response, RECIPIENT)).toThrow("Something new");
  });

  it("fails when the recipient is missing in the response", () => {
    expect(() =>
      parseSmsRuSendResponse({ status: "OK", status_code: 100, sms: {} }, RECIPIENT),
    ).toThrow(SmsSendError);
  });

  it("fails on non-object payloads", () => {
    expect(() => parseSmsRuSendResponse("100", RECIPIENT)).toThrow(SmsSendError);
    expect(() => parseSmsRuSendResponse(null, RECIPIENT)).toThrow(SmsSendError);
  });
});

describe("SmsRuProvider", () => {
  it("requires an api id", () => {
    expect(() => new SmsRuProvider("")).toThrow("SMSRU_API_ID is required");
  });

  it("POSTs form-encoded parameters (no secrets in the URL) and returns the sms id", async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(okResponse));
    const provider = new SmsRuProvider("api-id-123", "LMS", fetchMock);

    const result = await provider.send({ to: "+79161234567", text: "Код входа в LMS: 123456" });

    expect(result).toEqual({ providerMessageId: "000000-10000000" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = init.body as URLSearchParams;

    expect(url).toBe(SMSRU_SEND_URL);
    expect(url).not.toContain("api-id-123");
    expect(init.method).toBe("POST");
    expect(body.get("api_id")).toBe("api-id-123");
    expect(body.get("to")).toBe(RECIPIENT);
    expect(body.get("msg")).toBe("Код входа в LMS: 123456");
    expect(body.get("json")).toBe("1");
    expect(body.get("from")).toBe("LMS");
  });

  it("omits the sender when it is not configured", async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(okResponse));
    const provider = new SmsRuProvider("api-id-123", undefined, fetchMock);

    await provider.send({ to: "+79161234567", text: "hi" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect((init.body as URLSearchParams).has("from")).toBe(false);
  });

  it("throws SmsSendError with the provider code on API errors", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse({ status: "ERROR", status_code: 103, status_text: "x" }));
    const provider = new SmsRuProvider("api-id-123", undefined, fetchMock);

    await expect(provider.send({ to: "+79161234567", text: "hi" })).rejects.toMatchObject({
      name: "SmsSendError",
      providerCode: 103,
    });
  });

  it("throws SmsSendError on HTTP errors", async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({}, { ok: false, status: 502 }));
    const provider = new SmsRuProvider("api-id-123", undefined, fetchMock);

    await expect(provider.send({ to: "+79161234567", text: "hi" })).rejects.toThrow(
      "SMS.RU HTTP 502",
    );
  });

  it("throws SmsSendError on network errors without leaking the request", async () => {
    const fetchMock = jest.fn().mockRejectedValue(new TypeError("fetch failed"));
    const provider = new SmsRuProvider("api-id-123", undefined, fetchMock);

    const error = await provider.send({ to: "+79161234567", text: "123456" }).catch((e) => e);

    expect(error).toBeInstanceOf(SmsSendError);
    expect(error.message).not.toContain("api-id-123");
    expect(error.message).not.toContain("123456");
  });
});
