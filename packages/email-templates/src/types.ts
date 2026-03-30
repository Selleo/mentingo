import { SupportedLanguages } from "@repo/shared";

export type DefaultEmailSettings = {
  primaryColor: string;
  companyName: string;
  language: SupportedLanguages;
};

export type EmailContent = {
  heading: string;
  paragraphs: string[];
  buttonText: string;
};

export type BaseEmailSettings = Omit<DefaultEmailSettings, "language">;
