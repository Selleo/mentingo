export class SmsSendError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly providerCode?: number,
  ) {
    super(message);
    this.name = "SmsSendError";
  }
}
