import { describe, expect, it } from "vitest";

import pl from "../../../locales/pl/translation.json";

function translationValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(translationValues);
  }
  return [];
}

describe("Polish course catalog translations", () => {
  it("uses Katalog kursów throughout the real locale, including integrations and messages", () => {
    expect(pl.contentMarketplace).toMatchObject({
      title: "Katalog kursów",
      browseAll: "Przeglądaj",
      unavailable:
        "Katalog kursów nie jest włączony dla tej organizacji. Skontaktuj się z administratorem.",
      serviceError: "Katalog kursów jest niedostępny. Spróbuj ponownie.",
      empty: "W katalogu kursów nie ma jeszcze żadnych kursów.",
      error: {
        unavailable: "Katalog kursów nie jest dostępny dla tej organizacji.",
        listingNotFound: "Nie znaleziono tego kursu w katalogu kursów.",
        thumbnailNotFound: "Ten kurs z katalogu kursów nie ma miniatury.",
        serviceError: "Katalog kursów nie mógł zrealizować żądania. Spróbuj ponownie później.",
      },
    });
    expect(pl.environmentConfigurationView.dialog.serviceNames.contentMarketplace).toBe(
      "Katalog kursów",
    );
    expect(pl.environmentConfigurationView.dialog.serviceDescriptions.contentMarketplace).toBe(
      "Odkrywaj i importuj gotowe kursy z katalogu kursów.",
    );
    expect(pl.adminUsersView.permissionsMatrix.descriptions.content_marketplace_browse).toBe(
      "Przeglądanie katalogu kursów i kopiowanie jego kursów (kopiowanie wymaga też tworzenia kursów).",
    );
    expect(pl.nativeArchive.errors.courseNotSyncable).toBe(
      "Ten kurs został dodany jako edytowalna kopia i nie można go zsynchronizować. Usuń go i dodaj ponownie z katalogu kursów.",
    );

    // Translation identifiers remain stable; only user-facing values are renamed.
    expect(translationValues(pl).filter((value) => /marketplace/i.test(value))).toEqual([]);
  });
});
