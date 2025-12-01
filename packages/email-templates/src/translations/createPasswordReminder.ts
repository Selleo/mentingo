import { EmailContent, Language } from "types";

export const getCreatePasswordReminderEmailTranslations = (language: Language) => {
  const emailContent: Record<Language, EmailContent> = {
    en: {
      heading: "Reminder",
      paragraphs: [
        "This is a friendly reminder that your account is not yet fully set up. 🔒",
        "To complete your account setup, please create your password by clicking the button below. If you have already created your password, please disregard this reminder.",
      ],
      buttonText: "CREATE PASSWORD",
    },
    pl: {
      heading: "Przypomnienie",
      paragraphs: [
        "To przypomnienie, że Twoje konto nie zostało jeszcze w pełni skonfigurowane. 🔒",
        "Aby zakończyć konfigurację konta, utwórz hasło, klikając przycisk poniżej. Jeśli hasło zostało już utworzone, zignoruj tę wiadomość.",
      ],
      buttonText: "UTWÓRZ HASŁO",
    },
  };

  return emailContent[language] ?? emailContent.en;
};
