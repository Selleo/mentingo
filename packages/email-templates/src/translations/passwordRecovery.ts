import { SupportedLanguages } from "@repo/shared";
import { EmailContent } from "types";

export const getPasswordRecoveryEmailTranslations = (
  language: SupportedLanguages,
  name: string,
) => {
  const emailContent: Record<SupportedLanguages, EmailContent> = {
    en: {
      heading: "Password Recovery",
      paragraphs: [
        `Hey ${name}, you've requested a password reset 🔑`,
        "You can reset your password using the button below.",
      ],
      buttonText: "RESET PASSWORD",
    },
    pl: {
      heading: "Odzyskiwanie hasła",
      paragraphs: [
        `Cześć ${name}, poprosiłeś(-aś) o reset hasła 🔑`,
        "Możesz zresetować swoje hasło, klikając przycisk poniżej.",
      ],
      buttonText: "ZRESETUJ HASŁO",
    },
    de: {
      heading: "Passwort-Wiederherstellung",
      paragraphs: [
        `Hallo ${name}, du hast das Zurücksetzen deines Passworts angefordert 🔑`,
        "Du kannst dein Passwort über die Schaltfläche unten zurücksetzen.",
      ],
      buttonText: "PASSWORT ZURÜCKSETZEN",
    },
    lt: {
      heading: "Slaptažodžio atkūrimas",
      paragraphs: [
        `Sveiki ${name}, paprašei atkurti slaptažodį 🔑`,
        "Gali atkurti slaptažodį paspaudęs mygtuką žemiau.",
      ],
      buttonText: "ATKURTI SLAPTAŽODĮ",
    },
    cs: {
      heading: "Obnovení hesla",
      paragraphs: [
        `Ahoj ${name}, požádal(a) jsi o reset hesla 🔑`,
        "Své heslo můžeš obnovit pomocí tlačítka níže.",
      ],
      buttonText: "RESETOVAT HESLO",
    },
  };

  return emailContent[language] ?? emailContent.en;
};
