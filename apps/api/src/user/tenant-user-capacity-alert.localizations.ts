import { TENANT_USER_CAPACITY_ALERT_LEVELS, type SupportedLanguages } from "@repo/shared";
import { match } from "ts-pattern";

import type {
  NotifiedTenantUserCapacityAlertLevel,
  TenantUserCapacity,
  TenantUserCapacityAlertTexts,
} from "src/user/types/tenant-user-limit.types";

export const getTenantUserCapacityAlertTexts = (
  alertLevel: NotifiedTenantUserCapacityAlertLevel,
  { activeUsersCount, maxUsers, allowedUsersCount }: TenantUserCapacity,
): Record<SupportedLanguages, TenantUserCapacityAlertTexts> => {
  const excessUsersCount = activeUsersCount - allowedUsersCount;

  return match(alertLevel)
    .with(TENANT_USER_CAPACITY_ALERT_LEVELS.APPROACHING_LIMIT, () => ({
      en: {
        title: "Your organization is approaching its user limit",
        message: `${activeUsersCount} of the ${maxUsers} users in your plan are active. Archive users who no longer need access or contact support to raise the limit.`,
      },
      pl: {
        title: "Twoja organizacja zbliża się do limitu użytkowników",
        message: `Aktywnych jest ${activeUsersCount} z ${maxUsers} użytkowników w Twoim planie. Zarchiwizuj użytkowników, którzy nie potrzebują już dostępu, lub skontaktuj się z pomocą techniczną, aby zwiększyć limit.`,
      },
      de: {
        title: "Ihre Organisation nähert sich ihrem Benutzerlimit",
        message: `${activeUsersCount} der ${maxUsers} Benutzer in Ihrem Tarif sind aktiv. Archivieren Sie Benutzer, die keinen Zugang mehr benötigen, oder wenden Sie sich an den Support, um das Limit zu erhöhen.`,
      },
      lt: {
        title: "Jūsų organizacija artėja prie naudotojų limito",
        message: `Aktyvūs ${activeUsersCount} iš ${maxUsers} jūsų plane numatytų naudotojų. Suarchyvuokite naudotojus, kuriems prieigos nebereikia, arba susisiekite su pagalba, kad limitas būtų padidintas.`,
      },
      cs: {
        title: "Vaše organizace se blíží limitu uživatelů",
        message: `Aktivních je ${activeUsersCount} z ${maxUsers} uživatelů ve vašem plánu. Archivujte uživatele, kteří už přístup nepotřebují, nebo kontaktujte podporu pro navýšení limitu.`,
      },
      es: {
        title: "Tu organización se acerca a su límite de usuarios",
        message: `Hay ${activeUsersCount} de los ${maxUsers} usuarios de tu plan activos. Archiva a los usuarios que ya no necesiten acceso o contacta con soporte para aumentar el límite.`,
      },
      fr: {
        title: "Votre organisation approche de sa limite d'utilisateurs",
        message: `${activeUsersCount} des ${maxUsers} utilisateurs de votre offre sont actifs. Archivez les utilisateurs qui n'ont plus besoin d'accès ou contactez le support pour augmenter la limite.`,
      },
    }))
    .with(TENANT_USER_CAPACITY_ALERT_LEVELS.LIMIT_REACHED, () => ({
      en: {
        title: "Your organization has reached its user limit",
        message: `${activeUsersCount} users are active and your plan includes ${maxUsers}. You can have up to ${allowedUsersCount} users in total; after that, new users will be blocked. Contact support to raise the limit.`,
      },
      pl: {
        title: "Twoja organizacja osiągnęła limit użytkowników",
        message: `Aktywnych użytkowników: ${activeUsersCount}, a Twój plan obejmuje ${maxUsers}. Łącznie możesz mieć do ${allowedUsersCount} użytkowników; potem dodawanie nowych zostanie zablokowane. Skontaktuj się z pomocą techniczną, aby zwiększyć limit.`,
      },
      de: {
        title: "Ihre Organisation hat ihr Benutzerlimit erreicht",
        message: `${activeUsersCount} Benutzer sind aktiv, Ihr Tarif umfasst ${maxUsers}. Insgesamt sind bis zu ${allowedUsersCount} Benutzer möglich; danach werden neue Benutzer blockiert. Wenden Sie sich an den Support, um das Limit zu erhöhen.`,
      },
      lt: {
        title: "Jūsų organizacija pasiekė naudotojų limitą",
        message: `Aktyvių naudotojų: ${activeUsersCount}, o jūsų plane numatyta ${maxUsers}. Iš viso galite turėti iki ${allowedUsersCount} naudotojų; vėliau nauji naudotojai bus blokuojami. Susisiekite su pagalba, kad limitas būtų padidintas.`,
      },
      cs: {
        title: "Vaše organizace dosáhla limitu uživatelů",
        message: `Aktivních uživatelů je ${activeUsersCount} a váš plán zahrnuje ${maxUsers}. Celkem můžete mít až ${allowedUsersCount} uživatelů; poté bude přidávání nových blokováno. Kontaktujte podporu pro navýšení limitu.`,
      },
      es: {
        title: "Tu organización ha alcanzado su límite de usuarios",
        message: `Hay ${activeUsersCount} usuarios activos y tu plan incluye ${maxUsers}. Puedes tener hasta ${allowedUsersCount} usuarios en total; después, se bloquearán los nuevos usuarios. Contacta con soporte para aumentar el límite.`,
      },
      fr: {
        title: "Votre organisation a atteint sa limite d'utilisateurs",
        message: `${activeUsersCount} utilisateurs sont actifs et votre offre en inclut ${maxUsers}. Vous pouvez avoir jusqu'à ${allowedUsersCount} utilisateurs au total ; au-delà, les nouveaux utilisateurs seront bloqués. Contactez le support pour augmenter la limite.`,
      },
    }))
    .with(TENANT_USER_CAPACITY_ALERT_LEVELS.CAPACITY_FULL, () => ({
      en: {
        title: "Your organization can't add more users",
        message: `All ${allowedUsersCount} user slots are in use, so users can't be added or unarchived. Archive users who no longer need access or contact support to raise the limit.`,
      },
      pl: {
        title: "Twoja organizacja nie może dodać więcej użytkowników",
        message: `Wykorzystano wszystkie ${allowedUsersCount} miejsca dla użytkowników, więc nie można dodawać użytkowników ani przywracać ich z archiwum. Zarchiwizuj użytkowników, którzy nie potrzebują już dostępu, lub skontaktuj się z pomocą techniczną, aby zwiększyć limit.`,
      },
      de: {
        title: "Ihre Organisation kann keine weiteren Benutzer hinzufügen",
        message: `Alle ${allowedUsersCount} Benutzerplätze sind belegt, daher können keine Benutzer hinzugefügt oder aus dem Archiv geholt werden. Archivieren Sie Benutzer, die keinen Zugang mehr benötigen, oder wenden Sie sich an den Support, um das Limit zu erhöhen.`,
      },
      lt: {
        title: "Jūsų organizacija nebegali pridėti daugiau naudotojų",
        message: `Užimtos visos ${allowedUsersCount} naudotojų vietos, todėl naudotojų pridėti ar išarchyvuoti negalima. Suarchyvuokite naudotojus, kuriems prieigos nebereikia, arba susisiekite su pagalba, kad limitas būtų padidintas.`,
      },
      cs: {
        title: "Vaše organizace nemůže přidat další uživatele",
        message: `Všech ${allowedUsersCount} míst pro uživatele je obsazeno, takže nelze přidávat uživatele ani je obnovovat z archivu. Archivujte uživatele, kteří už přístup nepotřebují, nebo kontaktujte podporu pro navýšení limitu.`,
      },
      es: {
        title: "Tu organización no puede añadir más usuarios",
        message: `Las ${allowedUsersCount} plazas de usuario están ocupadas, por lo que no se pueden añadir ni desarchivar usuarios. Archiva a los usuarios que ya no necesiten acceso o contacta con soporte para aumentar el límite.`,
      },
      fr: {
        title: "Votre organisation ne peut plus ajouter d'utilisateurs",
        message: `Les ${allowedUsersCount} places d'utilisateur sont toutes occupées : impossible d'ajouter ou de désarchiver des utilisateurs. Archivez les utilisateurs qui n'ont plus besoin d'accès ou contactez le support pour augmenter la limite.`,
      },
    }))
    .with(TENANT_USER_CAPACITY_ALERT_LEVELS.OVER_CAPACITY, () => ({
      en: {
        title: "Your organization has more users than its limit allows",
        message: `${activeUsersCount} users are active, but your limit is now ${allowedUsersCount}. Users can't be added or unarchived until at least ${excessUsersCount} users are archived. Contact support if you need a higher limit.`,
      },
      pl: {
        title: "Twoja organizacja ma więcej użytkowników, niż pozwala limit",
        message: `Aktywnych użytkowników: ${activeUsersCount}, a limit wynosi teraz ${allowedUsersCount}. Nie można dodawać użytkowników ani przywracać ich z archiwum, dopóki nie zarchiwizujesz co najmniej ${excessUsersCount} użytkowników. Skontaktuj się z pomocą techniczną, jeśli potrzebujesz wyższego limitu.`,
      },
      de: {
        title: "Ihre Organisation hat mehr Benutzer, als das Limit erlaubt",
        message: `${activeUsersCount} Benutzer sind aktiv, Ihr Limit beträgt jetzt ${allowedUsersCount}. Benutzer können erst wieder hinzugefügt oder aus dem Archiv geholt werden, wenn mindestens ${excessUsersCount} Benutzer archiviert sind. Wenden Sie sich an den Support, wenn Sie ein höheres Limit benötigen.`,
      },
      lt: {
        title: "Jūsų organizacijoje yra daugiau naudotojų, nei leidžia limitas",
        message: `Aktyvių naudotojų: ${activeUsersCount}, o limitas dabar yra ${allowedUsersCount}. Naudotojų pridėti ar išarchyvuoti negalima, kol nesuarchyvuosite bent ${excessUsersCount} naudotojų. Susisiekite su pagalba, jei reikia didesnio limito.`,
      },
      cs: {
        title: "Vaše organizace má více uživatelů, než limit dovoluje",
        message: `Aktivních uživatelů je ${activeUsersCount}, ale limit je nyní ${allowedUsersCount}. Uživatele nelze přidávat ani obnovovat z archivu, dokud nearchivujete alespoň ${excessUsersCount} uživatelů. Pokud potřebujete vyšší limit, kontaktujte podporu.`,
      },
      es: {
        title: "Tu organización tiene más usuarios de los que permite su límite",
        message: `Hay ${activeUsersCount} usuarios activos, pero tu límite ahora es ${allowedUsersCount}. No se pueden añadir ni desarchivar usuarios hasta que archives al menos ${excessUsersCount}. Contacta con soporte si necesitas un límite mayor.`,
      },
      fr: {
        title: "Votre organisation compte plus d'utilisateurs que sa limite ne le permet",
        message: `${activeUsersCount} utilisateurs sont actifs, mais votre limite est désormais de ${allowedUsersCount}. Impossible d'ajouter ou de désarchiver des utilisateurs tant qu'au moins ${excessUsersCount} utilisateurs n'ont pas été archivés. Contactez le support si vous avez besoin d'une limite plus élevée.`,
      },
    }))
    .exhaustive();
};
