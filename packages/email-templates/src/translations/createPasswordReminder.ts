import { SupportedLanguages } from "@repo/shared";
import { EmailContent } from "types";

export const getCreatePasswordReminderEmailTranslations = (language: SupportedLanguages) => {
  const emailContent: Record<SupportedLanguages, EmailContent> = {
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
    de: {
      heading: "Erinnerung",
      paragraphs: [
        "Dies ist eine freundliche Erinnerung, dass dein Konto noch nicht vollständig eingerichtet ist. 🔒",
        "Um die Einrichtung abzuschließen, erstelle bitte dein Passwort über die Schaltfläche unten. Falls du dein Passwort bereits erstellt hast, ignoriere diese Erinnerung.",
      ],
      buttonText: "PASSWORT ERSTELLEN",
    },
    lt: {
      heading: "Priminimas",
      paragraphs: [
        "Tai draugiškas priminimas, kad tavo paskyra dar nėra visiškai nustatyta. 🔒",
        "Norėdamas užbaigti paskyros nustatymą, sukurk slaptažodį paspausdamas mygtuką žemiau. Jei slaptažodį jau sukūrei, ignoruok šį priminimą.",
      ],
      buttonText: "SUKURTI SLAPTAŽODĮ",
    },
    cs: {
      heading: "Připomenutí",
      paragraphs: [
        "Toto je přátelská připomínka, že tvůj účet ještě není plně nastaven. 🔒",
        "Pro dokončení nastavení účtu si vytvoř heslo kliknutím na tlačítko níže. Pokud už heslo máš vytvořené, tuto připomínku ignoruj.",
      ],
      buttonText: "VYTVOŘIT HESLO",
    },
  };

  return emailContent[language] ?? emailContent.en;
};
