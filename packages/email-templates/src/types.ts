export type Language = "en" | "pl";

export type DefaultEmailSettings = {
  primaryColor: string;
  language: Language;
};

export type EmailContent = {
  heading: string;
  paragraphs: string[];
  buttonText: string;
};

export type BaseEmailSettings = Pick<DefaultEmailSettings, "primaryColor">;
