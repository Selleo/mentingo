export type Language = "en" | "pl";

export type DefaultEmailSettings = {
  primaryColor: string;
  companyName: string;
  language: Language;
};

export type EmailContent = {
  heading: string;
  paragraphs: string[];
  buttonText: string;
};

export type BaseEmailSettings = Omit<DefaultEmailSettings, "language">;
