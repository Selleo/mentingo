import { SupportedLanguages } from "@repo/shared";
import { EmailContent } from "types";

export const getMagicLinkEmailTranslations = (language: SupportedLanguages) => {
  const emailContent: Record<SupportedLanguages, EmailContent> = {
    en: {
      heading: "Login Link",
      paragraphs: [
        "You have received a login link to your account. Click the button below to open it.",
      ],
      buttonText: "OPEN LOGIN LINK",
    },
    pl: {
      heading: "Link do logowania",
      paragraphs: [
        "Otrzymałeś link do logowania do swojego konta. Kliknij przycisk poniżej, aby go otworzyć.",
      ],
      buttonText: "OTWÓRZ LINK DO LOGOWANIA",
    },
    de: {
      heading: "Anmeldelink",
      paragraphs: [
        "Du hast einen Anmeldelink für dein Konto erhalten. Klicke auf die Schaltfläche unten, um ihn zu öffnen.",
      ],
      buttonText: "ANMELDELINK ÖFFNEN",
    },
    lt: {
      heading: "Prisijungimo nuoroda",
      paragraphs: [
        "Gavai prisijungimo nuorodą į savo paskyrą. Paspausk mygtuką žemiau, kad ją atidarytum.",
      ],
      buttonText: "ATIDARYTI PRISIJUNGIMO NUORODĄ",
    },
    cs: {
      heading: "Přihlašovací odkaz",
      paragraphs: [
        "Obdržel(a) jsi přihlašovací odkaz ke svému účtu. Klikni na tlačítko níže a otevři ho.",
      ],
      buttonText: "OTEVŘÍT PŘIHLAŠOVACÍ ODKAZ",
    },
  };

  return emailContent[language] ?? emailContent.en;
};
