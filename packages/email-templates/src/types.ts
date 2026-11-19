import { SupportedLanguages } from "@repo/shared";

export type DefaultEmailSettings = {
  primaryColor: string;
  companyName: string;
  language: SupportedLanguages;
};

export type EmailContentLink = { text: string; url: string };

export type EmailContent = {
  heading: string;
  paragraphs: string[];
  buttonText: string;
  links?: EmailContentLink[];
};

export type BaseEmailSettings = Omit<DefaultEmailSettings, "language">;
