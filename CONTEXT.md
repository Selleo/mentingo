# Cohort Learning Context

## Pojęcia

- **Kurs** — przestrzeń nauki, wokół której organizuje się kohorta kursu oraz dyskusje.
- **Kohorta kursu** — grupa aktywnie zapisanych uczniów danego kursu.
- **Uczestnik kohorty** — użytkownik, który ma aktywny zapis do kursu i należy do kohorty tego kursu.
- **Personel kursu** — admin albo twórca kursu, który może uczestniczyć w dyskusjach oraz moderować treści kursu bez bycia uczestnikiem kohorty.
- **Wątek dyskusji** — rozmowa przypięta do kursu albo do konkretnej lekcji w kursie.
- **Komentarz** — odpowiedź opublikowana wewnątrz wątku dyskusji.
- **Ukończenie kursu** — stan, w którym aktywnie zapisany uczeń ukończył kurs.

## Relacje

- **Kurs** ma jedną **kohortę kursu**.
- **Uczestnik kohorty** może tworzyć **wątki dyskusji** i **komentarze**.
- **Personel kursu** może moderować treści kohorty, ale nie jest liczony jako **uczestnik kohorty**.
- **Wątek dyskusji** należy do **kursu** albo do **lekcji**.

## Przykład dialogu

> **Uczestnik kohorty:** Jestem zapisany do kursu, więc mogę dodać wątek i komentować lekcje.
>
> **Personel kursu:** Nie należę do kohorty jako uczeń, ale nadal mogę odpowiadać i moderować dyskusję.

## Granice znaczeniowe

- Udział w kohorcie oznacza udział ucznia w nauce razem z innymi zapisanymi uczniami.
- Dostęp moderacyjny oznacza uprawnienie do wspierania i porządkowania dyskusji, nawet bez uczestnictwa w kohorcie.
