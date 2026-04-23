import type { MailHogAPI } from "./generated-mailhog-api";

export type GeneratedMailhogSearchResponse = Awaited<
  ReturnType<MailHogAPI<unknown>["api"]["v2SearchList"]>
>["data"];

export type GeneratedMailhogMessage = NonNullable<
  GeneratedMailhogSearchResponse["messages"]
>[number];

export type MailhogHeaderMap = Partial<
  Record<
    | "Content-Type"
    | "Date"
    | "From"
    | "MIME-Version"
    | "Message-ID"
    | "Received"
    | "Return-Path"
    | "Subject"
    | "To",
    string[]
  >
> &
  Record<string, string[] | undefined>;

export type MailhogMessage = GeneratedMailhogMessage & {
  headers?: MailhogHeaderMap;
  Content?: {
    Headers?: MailhogHeaderMap;
    Body?: string;
  };
  MIME?: {
    Parts?: Array<{
      Headers?: MailhogHeaderMap;
      Body?: string;
    }>;
  };
  Raw?: {
    Data?: string;
  };
};

export type MailhogSearchResponse = Omit<GeneratedMailhogSearchResponse, "messages"> & {
  items?: MailhogMessage[];
};
