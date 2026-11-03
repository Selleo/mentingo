import type { PhishingReportRecipient } from "../schemas/phishing.schema";
import type { createPhishingClient } from "@mentingo/phishing-simulation-sdk";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import type { Pagination } from "src/common";

export type PhishingClient = ReturnType<typeof createPhishingClient>;

export type PhishingGroupScope = string[] | null;

export type PhishingReportRecipientsPage = {
  data: PhishingReportRecipient[];
  pagination: Pagination;
};

export type SignedPhishingRequest = RawBodyRequest<Request> & { rawBody: Buffer };
