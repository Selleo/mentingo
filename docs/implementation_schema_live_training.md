# Schemat implementacji: Szkolenia na Żywo

Live Trainings / Live Sessions w LMS z Kalendarzem, LiveKit, prezentacją, powiadomieniami i obecnością

## 1. Cel funkcji

System powinien umożliwiać tworzenie i prowadzenie szkoleń na żywo w LMS. Szkolenie na żywo może działać jako osobna lekcja w kursie albo jako niezależne wydarzenie kalendarzowe niezlinkowane z żadnym kursem.

Funkcja obejmuje osobny widok Kalendarza, konfigurację szkolenia, przypisywanie uczestników, materiały szkoleniowe, uruchamianie sesji przez trenera, udział obserwatorów, statusy sesji, powiadomienia oraz zbieranie danych o obecności i czasie uczestnictwa.

**Kluczowa zasada: Live Training jest wydarzeniem szkoleniowym prowadzonym przez Trenera. Obserwatorzy mogą dołączyć tylko do szkoleń, do których zostali przypisani.**

## 2. Założenia końcowe

Do obsługi online meetingu wykorzystywany jest LiveKit.

Zarówno Trener, jak i Obserwator mają dostęp do osobnego widoku Kalendarza.

Widok Kalendarza zawiera wszystkie Szkolenia na Żywo widoczne dla danego użytkownika zgodnie z jego rolą i przypisaniami.

Obserwator może dołączyć wyłącznie do szkoleń, do których został przypisany.

Dzisiejszy dzień jest podświetlony w kalendarzu.

Jeżeli dzisiaj odbywa się Live Training dostępny dla użytkownika, ikona/pozycja Kalendarza w lewym sidebarze posiada widoczny indicator.

Jeżeli Live Training już trwa, system wyświetla popup szybkiego dołączenia. Popup pojawia się raz na sesję i użytkownika; dismiss jest zapisywany w localStorage. Zustand może zarządzać bieżącym stanem UI.

Szkolenie może być zlinkowane z kursem, ale nie musi.

Szkolenie zlinkowane z kursem jest traktowane jako normalna osobna lekcja w kursie.

Zakończenie szkolenia przez Trenera oznacza automatyczne zaliczenie lekcji w kursie dla wszystkich przypisanych uczestników.

Materiały PPTX są renderowane/obsługiwane bezpośrednio, bez obowiązkowej konwersji do PDF lub obrazów w MVP.

## 3. Role i uprawnienia

### 3.1 Content Creator

Content Creator jest rolą odpowiedzialną za tworzenie szkoleń i linkowanie ich do własnych kursów.

może tworzyć Live Trainingi, w których sam jest wskazany jako Trener;

może edytować swoje Live Trainingi przed rozpoczęciem, zgodnie z regułami edycji eventu;

może przypisywać studentów/obserwatorów do swoich szkoleń;

może dodawać i aktualizować materiały szkoleniowe;

może zlinkować swoje szkolenie Live do swojego kursu;

nie może przypisać innej osoby jako Trenera; może wskazać tylko siebie.

**Decyzja: szkolenia mogą tworzyć i linkować tylko Administrator oraz Content Creator. Content Creator działa wyłącznie w zakresie własnych kursów i własnych szkoleń.**

### 3.2 Trener

Trener jest osobą prowadzącą konkretną sesję. W praktyce Trener może być Content Creatorem albo osobą przypisaną przez Administratora.

może rozpocząć szkolenie, do którego został przypisany jako Trener;

może prowadzić prezentację i komunikację głosową;

może udostępniać ekran, jeśli funkcja jest włączona;

może zakończyć szkolenie;

może widzieć listę uczestników i dane obecności dla prowadzonego szkolenia;

nie może samodzielnie zmieniać przypisanego Trenera, jeśli nie posiada roli Administratora.

### 3.3 Obserwator

Obserwator jest uczestnikiem szkolenia. Widzi i może dołączyć tylko do szkoleń, do których został przypisany.

może przeglądać przypisane szkolenia w Kalendarzu;

może dołączyć do trwającego lub dostępnego szkolenia;

może słuchać Trenera;

może oglądać prezentację, udostępniony ekran lub materiały;

może używać mikrofonu tylko wtedy, gdy toggle mikrofonu Obserwatorów został włączony przed startem szkolenia;

może przeglądać i pobierać materiały, jeśli konfiguracja na to pozwala;

nie może edytować szkolenia, materiałów ani prezentacji;

nie może kontrolować slajdów;

nie może zakończyć szkolenia;

nie może pokazywać własnego ekranu.

### 3.4 Administrator

Administrator ma pełne uprawnienia zarządzania szkoleniami w zakresie swojej organizacji/tenanta.

może tworzyć Live Trainingi;

może edytować Live Trainingi;

może przypisać lub zmienić Trenera podczas tworzenia/edycji szkolenia;

może wskazać dowolnego użytkownika z odpowiednimi uprawnieniami jako Trenera;

może przypisywać studentów/obserwatorów;

może dodać nowe szkolenie Live do kursu;

może zlinkować istniejące szkolenie Live z dowolnym kursem, do którego ma uprawnienia administracyjne;

może zarządzać szkoleniami niezależnymi od kursów;

może widzieć raporty obecności.

## 4. Mikrofon Obserwatorów

Domyślnie Obserwatorzy działają w trybie listen/view-only: mogą słuchać i oglądać, ale nie mogą mówić przez mikrofon ani nic prezentować. Dostęp do mikrofonu Obserwatorów jest sterowany togglem w konfiguracji szkolenia.

**Decyzja: toggle mikrofonu Obserwatorów jest ustawiany wyłącznie przed startem szkolenia, podczas tworzenia lub edycji eventu przed rozpoczęciem. Po rozpoczęciu sesji nie zmienia się tego ustawienia.**

| **Ustawienie**                         | **Zachowanie systemu**                                                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Toggle mikrofonu Obserwatorów: OFF** | **Obserwatorzy mogą tylko słuchać i oglądać. Przycisk mikrofonu nie jest dostępny albo jest disabled z komunikatem wyjaśniającym.**                           |
| **Toggle mikrofonu Obserwatorów: ON**  | **Obserwatorzy mogą mówić przez mikrofon w trakcie sesji. Nadal nie mogą udostępniać ekranu, kontrolować slajdów, edytować materiałów ani moderować innych.** |

## 5. Widok Kalendarza

### 5.1 Dostęp do kalendarza

Kalendarz jest osobnym widokiem dostępnym z lewego sidebara. Widok powinien pokazywać szkolenia zgodnie z rolą użytkownika.

| **Rola**            | **Widoczność w kalendarzu**                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------- |
| **Content Creator** | **Widzi swoje szkolenia oraz szkolenia powiązane z jego kursami, zgodnie z uprawnieniami.** |
| **Trener**          | **Widzi szkolenia, które prowadzi.**                                                        |
| **Obserwator**      | **Widzi tylko szkolenia, do których został przypisany.**                                    |
| **Administrator**   | **Widzi wszystkie szkolenia w ramach swojej organizacji/tenanta.**                          |

### 5.2 UI kalendarza

Dzisiejszy dzień jest wizualnie podświetlony.

Szkolenia widoczne są jako eventy w kalendarzu.

Event może trwać jeden dzień lub wiele dni.

Event może być online albo offline.

Event może być zlinkowany z kursem albo być samodzielnym szkoleniem.

Kliknięcie eventu pokazuje szczegóły szkolenia oraz dostępne akcje zależne od roli.

### 5.3 Indicator w sidebarze

Jeśli w aktualnym dniu użytkownik ma widoczne Live Trainingi, pozycja Kalendarza w lewym sidebarze powinna mieć indicator.

Indicator jest widoczny tylko wtedy, gdy użytkownik ma dzisiaj co najmniej jedno przypisane/prowadzone szkolenie.

Indicator nie powinien pokazywać szkoleń, do których użytkownik nie ma dostępu.

Dla Administratora indicator uwzględnia szkolenia widoczne administracyjnie zgodnie z zakresem organizacji/tenanta.

### 5.4 Popup szybkiego dołączenia

Jeśli Live Training już trwa, system powinien wyświetlić popup pozwalający szybko dołączyć do sesji.

| **Zasada**        | **Decyzja implementacyjna**                                                                                          |
| ----------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Częstotliwość** | **Popup pojawia się raz na sesję i użytkownika.**                                                                    |
| **Dismiss**       | **Po zamknięciu popupu zapisujemy dismissed w localStorage, np. liveTrainingPopupDismissed:<sessionId>:<userId>.**   |
| **Stan UI**       | **Zustand może przechowywać bieżący stan popupu w sesji aplikacji, ale localStorage jest źródłem trwałego dismiss.** |
| **Trener**        | **Popup pokazuje aktywne szkolenie prowadzone przez Trenera i umożliwia szybkie przejście do prowadzenia sesji.**    |
| **Obserwator**    | **Popup pokazuje aktywne przypisane szkolenie i umożliwia szybkie dołączenie jako Obserwator.**                      |

## 6. Tworzenie i edycja szkoleń

### 6.1 Dane szkolenia

| **Pole**                  | **Wymagane**        | **Opis**                                                                                                  |
| ------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------- |
| **Nazwa**                 | **Tak**             | **Nazwa szkolenia widoczna w kalendarzu i lekcji.**                                                       |
| **Opis**                  | **Opcjonalnie**     | **Opis szkolenia widoczny dla przypisanych użytkowników.**                                                |
| **Data rozpoczęcia**      | **Tak**             | **Planowana data i godzina rozpoczęcia.**                                                                 |
| **Data zakończenia**      | **Zalecane**        | **Planowana data i godzina zakończenia; event może trwać wiele dni.**                                     |
| **Typ**                   | **Tak**             | **Online Live Training albo Offline Training/Event.**                                                     |
| **Trener**                | **Tak**             | **Content Creator może wskazać tylko siebie; Administrator może wskazać dowolnego uprawnionego Trenera.** |
| **Obserwatorzy/studenci** | **Tak/Opcjonalnie** | **Lista przypisanych uczestników lub wynik przypisania przez kurs/grupę.**                                |
| **Materiały**             | **Opcjonalnie**     | **PDF/PPTX/dokumenty dostępne przed i po szkoleniu. PPTX obsługiwany bezpośrednio.**                      |
| **Powiązany kurs/lekcja** | **Opcjonalnie**     | **Szkolenie może być zlinkowane z kursem jako lekcja albo pozostać niezależne.**                          |
| **Mikrofon Obserwatorów** | **Konfigurowalne**  | **Toggle ustawiany tylko przed startem. Domyślnie OFF.**                                                  |

### 6.2 Uprawnienia tworzenia i linkowania

| **Akcja**                         | **Content Creator**                                                           | **Administrator**                                         |
| --------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------- |
| **Utworzenie szkolenia**          | **Tak, tylko dla siebie jako Trenera**                                        | **Tak, z możliwością wyboru Trenera**                     |
| **Edycja szkolenia**              | **Tak, jeśli jest właścicielem/prowadzącym i sesja jeszcze nie wystartowała** | **Tak, zgodnie z regułami systemu**                       |
| **Przypisanie studentów**         | **Tak, w swoich szkoleniach/kursach**                                         | **Tak**                                                   |
| **Zmiana Trenera**                | **Nie**                                                                       | **Tak**                                                   |
| **Linkowanie szkolenia do kursu** | **Tak, własne szkolenie do własnego kursu**                                   | **Tak, dowolne zgodnie z uprawnieniami organizacji**      |
| **Usunięcie szkolenia**           | **Według reguł usuwania lekcji/wydarzenia dla własnego zasobu**               | **Według reguł usuwania lekcji/wydarzenia w organizacji** |

## 7. Integracja z kursem i lekcją

Live Training może być powiązany z kursem jako normalna lekcja. Może też istnieć samodzielnie bez żadnego kursu.

### 7.1 Szkolenie zlinkowane z kursem

Administrator może dodać nowe szkolenie Live do kursu.

Administrator może zlinkować istniejące szkolenie Live do kursu.

Content Creator może zlinkować swoje szkolenie Live do swojego kursu.

Zlinkowane szkolenie jest traktowane jako osobna lekcja w kursie.

Lekcja ma własny status, widok i progres.

W lekcji widoczne są dane szkolenia, materiały, status oraz przycisk dołączenia.

Po zakończeniu szkolenia lekcja zostaje automatycznie zaliczona wszystkim przypisanym uczestnikom, niezależnie od faktycznej obecności.

### 7.2 Szkolenie niezależne od kursu

Szkolenie nie musi być zlinkowane z żadnym kursem.

Wtedy istnieje wyłącznie jako wydarzenie w Kalendarzu.

Nadal posiada przypisanych uczestników, materiały, status, powiadomienia i dane obecności.

Nie wpływa na progres żadnego kursu, bo nie jest lekcją kursową.

### 7.3 Usuwanie szkoleń

Szkolenie zlinkowane z kursem usuwa się zgodnie z regułami usuwania lekcji w kursie.

Szkolenie niezależne usuwa się analogicznie do niezależnego wydarzenia/szkolenia w Kalendarzu.

Jeżeli system używa soft-delete, archiwizacji albo blokady usuwania zakończonych lekcji, te same reguły powinny obowiązywać dla Live Trainingów.

## 8. Cykl życia sesji

| **Status**              | **Opis**                                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| **Scheduled**           | **Szkolenie zaplanowane, ale jeszcze nierozpoczęte.**                                                     |
| **Waiting for trainer** | **Obserwatorzy mogą widzieć oczekiwanie, ale sesja nie wystartowała, ponieważ Trener jej nie uruchomił.** |
| **Active**              | **Sesja trwa. Użytkownicy z uprawnieniami mogą dołączyć.**                                                |
| **Ended**               | **Sesja została zakończona przez Trenera albo system.**                                                   |
| **Cancelled**           | **Szkolenie zostało anulowane.**                                                                          |
| **Expired**             | **Planowany czas minął, a szkolenie nie zostało uruchomione w dozwolonym oknie.**                         |

### 8.1 Uruchomienie szkolenia

Trener uruchamia szkolenie przyciskiem „Rozpocznij sesję”.

Backend tworzy albo aktywuje room w LiveKit i wydaje tokeny dostępowe zależne od roli użytkownika.

Po uruchomieniu status zmienia się na Active.

Przypisani Obserwatorzy mogą dołączyć do sesji.

System może wysłać powiadomienie o rozpoczęciu sesji.

Jeśli Obserwator wejdzie przed startem, widzi komunikat oczekiwania na Trenera.

```text
Przykładowy komunikat: Szkolenie rozpocznie się, gdy Trener uruchomi sesję.
```

### 8.2 Zakończenie szkolenia

Trener kończy szkolenie przyciskiem „Zakończ sesję”.

Meeting/room w LiveKit zostaje zamknięty lub użytkownicy zostają rozłączeni zgodnie z integracją.

Status zmienia się na Ended.

System finalizuje dane obecności.

Jeśli szkolenie jest lekcją w kursie, system automatycznie zalicza lekcję wszystkim przypisanym uczestnikom.

**Reguła końcowa: zaliczamy wszystkich przypisanych uczestników, a nie tylko tych, którzy faktycznie dołączyli.**

## 9. Materiały szkoleniowe

Do szkolenia można dołączyć materiały, które są dostępne przed i po wydarzeniu.

PDF;

PPTX;

inne dokumenty wspierające szkolenie;

materiały powinny być widoczne w szczegółach szkolenia;

użytkownik może je podejrzeć albo pobrać, jeśli posiada odpowiednie uprawnienie.

Podczas sesji Trener może używać materiałów jako prezentacji. Obserwatorzy oglądają prezentowany materiał, ale nie mogą go edytować ani kontrolować.

**Decyzja: PPTX obsługujemy bezpośrednio. Konwersja do PDF/obrazów nie jest wymagana w MVP, chyba że wynikną problemy stabilnościowe w przeglądarce.**

## 10. Powiadomienia

Przypisani Obserwatorzy otrzymują powiadomienie przed planowaną datą rozpoczęcia szkolenia.

Przypisani Obserwatorzy mogą otrzymać powiadomienie w momencie uruchomienia sesji przez Trenera.

Trener może otrzymać przypomnienie o zbliżającym się szkoleniu.

Jeśli szkolenie trwa, system pokazuje popup szybkiego dołączenia raz na sesję/użytkownika.

Kanały powiadomień: email, in-app notification, opcjonalnie push/websocket event.

**Minimum MVP: email przed szkoleniem + popup/in-app notification, jeśli szkolenie jest aktywne.**

## 11. Obecność i dane sesji

System zbiera informacje o sesji oraz obecności uczestników. Dane obecności są raportowe, ale nie warunkują zaliczenia lekcji w aktualnej decyzji produktowej.

### 11.1 Dane sesji

| **Dane**               | **Opis**                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| **Planowany start**    | **Data i godzina z konfiguracji szkolenia.**                                                  |
| **Faktyczny start**    | **Moment uruchomienia sesji przez Trenera.**                                                  |
| **Faktyczny koniec**   | **Moment zakończenia przez Trenera albo system.**                                             |
| **Czas trwania**       | **Różnica między faktycznym startem i końcem.**                                               |
| **Liczba uczestników** | **Liczba unikalnych uczestników lub peak concurrent users.**                                  |
| **Status końcowy**     | **Ended, Cancelled, Expired itd.**                                                            |
| **LiveKit room ID**    | **Identyfikator pokoju/sesji po stronie LiveKit, jeśli potrzebny do audytu lub debugowania.** |

### 11.2 Dane uczestnika

| **Dane**                | **Opis**                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **User ID**             | **Uczestnik szkolenia.**                                                                                                  |
| **Rola**                | **Trener, Obserwator, Administrator/moderator.**                                                                          |
| **Join time**           | **Moment dołączenia do sesji.**                                                                                           |
| **Leave time**          | **Moment opuszczenia sesji.**                                                                                             |
| **Total attended time** | **Suma czasu uczestnictwa, z obsługą reconnectów.**                                                                       |
| **Completion status**   | **Status zaliczenia, jeśli szkolenie jest lekcją kursową. Dla kursu: zaliczenie wszystkich przypisanych po zakończeniu.** |

## 12. Szkolenia offline

Szkolenia offline są wydarzeniami kalendarzowymi lub lekcjami kursowymi bez uruchamiania meetingu online.

offline training może być widoczny w Kalendarzu;

może mieć datę, opis, Trenera, uczestników i materiały;

nie wymaga LiveKit ani serwera audio/video;

po kliknięciu „Complete” przez Trenera szkolenie może zostać zaliczone uczestnikom zgodnie z regułą produktu;

jeśli jest zlinkowane z kursem, działa jako lekcja offline.

## 13. Założenia infrastrukturalne

Online meeting w Live Trainingach jest oparty o LiveKit. Backend LMS odpowiada za autoryzację, konfigurację sesji, wydawanie tokenów, statusy sesji, powiadomienia i zapis obecności.

LiveKit jako media/meeting server dla audio/video/screen share;

tokeny LiveKit generowane po stronie backendu na podstawie roli użytkownika i przypisania do szkolenia;

role LiveKit/mapowanie uprawnień: Trener/Moderator oraz Obserwator z mikrofonem ON/OFF zgodnie z konfiguracją;

storage na materiały szkoleniowe;

worker do powiadomień;

websocket/in-app notification gateway dla statusu i popupów;

attendance tracking oparty o eventy LMS/LiveKit lub logikę join/leave w backendzie.

| **Parametr**                                         | **Założenie początkowe**                 |
| ---------------------------------------------------- | ---------------------------------------- |
| **Maksymalna liczba uczestników per Live Training**  | **100**                                  |
| **Maksymalna liczba równoległych szkoleń globalnie** | **Do ustalenia**                         |
| **Meeting provider**                                 | **LiveKit**                              |
| **Nagrywanie**                                       | **Poza MVP, chyba że zostanie wymagane** |
| **Czat**                                             | **Poza MVP, chyba że zostanie wymagane** |
| **Whiteboard**                                       | **Poza MVP, chyba że zostanie wymagane** |

## 14. Szacowanie usage LiveKit

Poniższe wartości są orientacyjnym capacity planningiem dla self-hosted LiveKit. Rzeczywiste zużycie zależy od kodeka, ustawień simulcast/adaptive stream, urządzeń użytkowników, TURN, jakości sieci, liczby aktywnych tracków i tego, ile tracków UI faktycznie subskrybuje. Przed wdrożeniem produkcyjnym należy wykonać test obciążeniowy narzędziem LiveKit lk load-test albo własnym scenariuszem E2E.

**Założenie bazowe: 1 Live Training = 100 uczestników łącznie, czyli 1 Trener + 99 Obserwatorów. Scenariusz globalny = 5 równoległych Live Trainingów.**

### 14.1 Założenia bitrate

| **Medium / jakość**                  | **Przyjęty bitrate na publikowany track** | **Uwagi**                                                                                                    |
| ------------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Audio speech / Opus**              | **0.05 Mbps**                             | **Wartość planistyczna dla mowy. Realnie może być niżej/wyżej zależnie od DTX, RED i ustawień jakości.**     |
| **Kamera 360p**                      | **0.4 Mbps**                              | **Niska jakość/tile preview; dobra dla paginacji i wielu kamer.**                                            |
| **Kamera 720p**                      | **1.5 Mbps**                              | **Zgodne z przykładowym ustawieniem LiveKit h720 maxBitrate 1_500_000.**                                     |
| **Kamera 1080p**                     | **3.0 Mbps**                              | **Założenie planistyczne dla wyższej jakości. Wymaga realnych testów na docelowych urządzeniach.**           |
| **Screen share / prezentacja 1080p** | **2.0 Mbps**                              | **Założenie planistyczne. Screen share może mieć mniejszy lub większy bitrate zależnie od FPS i treści.**    |
| **Narzut WebRTC/SFU**                | **+20%**                                  | **Dodany w tabelach jako bezpieczny narzut na RTP/UDP/TLS, retransmisje, data packets i zmienność bitrate.** |

### 14.2 Wzór liczenia transferu

```text
server_mbps = (sum(published_track_bitrates) + sum(subscribed_track_bitrates_per_user)) * 1.20
```

```text
GB_per_hour ~= server_mbps * 0.45
```

Dla LiveKit Cloud istotny billingowo jest przede wszystkim downstream data transfer, czyli dane wychodzące z LiveKit do klientów. Dla self-hostingu trzeba patrzeć praktycznie na cały ruch sieciowy serwera, ale outbound zwykle dominuje.

### 14.3 Scenariusze zgodne z MVP/webinar mode

W aktualnym produkcie Obserwatorzy nie publikują kamery ani ekranu. Domyślnie tylko oglądają i słuchają. Mikrofon Obserwatorów może być włączony togglem, ale kamera i screen share po stronie Obserwatora nie są elementem MVP.

| **Scenariusz**                               | **Peak / 1 sesja** | **Peak / 5 sesji** | **Transfer / 5 sesji / 1h** |
| -------------------------------------------- | ------------------ | ------------------ | --------------------------- |
| **Tylko audio Trenera**                      | **~6 Mbps**        | **~30 Mbps**       | **~13.5 GB/h**              |
| **Kamera Trenera 720p + audio**              | **~186 Mbps**      | **~930 Mbps**      | **~418.5 GB/h**             |
| **Kamera Trenera 1080p + audio**             | **~366 Mbps**      | **~1.83 Gbps**     | **~823.5 GB/h**             |
| **Screen share 1080p + audio**               | **~246 Mbps**      | **~1.23 Gbps**     | **~553.5 GB/h**             |
| **Kamera 720p + screen share 1080p + audio** | **~426 Mbps**      | **~2.13 Gbps**     | **~958.5 GB/h**             |

**Wniosek: dla właściwego MVP najbardziej krytyczny jest outbound z LiveKit do widzów. 5 równoległych sesji po 100 osób z kamerą 720p Trenera mieści się orientacyjnie poniżej 1 Gbps, ale wariant kamera + screen share wymaga już około 2.1 Gbps z narzutem.**

### 14.4 Scenariusz z mikrofonem Obserwatorów

Jeżeli toggle mikrofonu Obserwatorów jest włączony, nie oznacza to automatycznie, że wszyscy powinni stale publikować audio. Produktowo warto wymusić push-to-talk, aktywny speaker albo limit jednocześnie mówiących osób.

| **Scenariusz**                                      | **Założenie**                             | **Peak / 1 sesja** | **Peak / 5 sesji** |
| --------------------------------------------------- | ----------------------------------------- | ------------------ | ------------------ |
| **Mikrofon Trenera + do 5 aktywnych Obserwatorów**  | **6 publikujących audio, reszta słucha**  | **~36 Mbps**       | **~180 Mbps**      |
| **Mikrofon Trenera + do 10 aktywnych Obserwatorów** | **11 publikujących audio, reszta słucha** | **~66 Mbps**       | **~330 Mbps**      |
| **Wszyscy Obserwatorzy mogą mówić naraz**           | **100 publikujących audio do wszystkich** | **~600 Mbps**      | **~3.0 Gbps**      |

**Rekomendacja: jeżeli mikrofon Obserwatorów jest ON, wprowadzić limit aktywnych mówców albo moderację głosu. Technicznie pełne audio all-to-all dla 100 osób jest możliwe, ale niepotrzebnie zwiększa koszt i chaos UX.**

### 14.5 Hipotetyczny scenariusz z paginacją video do 9 osób

Ten wariant nie jest aktualnym MVP, bo Obserwatorzy nie mają kamery. Warto go jednak zapisać jako future-proofing: przy 100 osobach w pokoju UI subskrybuje maksymalnie 9 widocznych kafelków video na użytkownika. To jest właśnie sens paginacji/selective subscriptions: użytkownik może być w pokoju ze 100 osobami, ale nie musi odbierać 99 strumieni video naraz.

| **Jakość kafelków** | **Założenie**                                                | **Peak / 1 sesja** | **Peak / 5 sesji** | **Transfer / 5 sesji / 1h** |
| ------------------- | ------------------------------------------------------------ | ------------------ | ------------------ | --------------------------- |
| **360p**            | **100 publikuje kamerę+audio; każdy odbiera max 9 kafelków** | **~540 Mbps**      | **~2.7 Gbps**      | **~1.2 TB/h**               |
| **720p**            | **100 publikuje kamerę+audio; każdy odbiera max 9 kafelków** | **~1.86 Gbps**     | **~9.3 Gbps**      | **~4.2 TB/h**               |
| **1080p**           | **100 publikuje kamerę+audio; każdy odbiera max 9 kafelków** | **~3.66 Gbps**     | **~18.3 Gbps**     | **~8.2 TB/h**               |

**Wniosek: paginacja do 9 użytkowników jest konieczna przy wielu kamerach, ale przy 5 równoległych sesjach 720p prawie dobija do 10 Gbps. Dlatego taki tryb nie powinien być domyślny dla Live Trainings.**

### 14.6 Szacowanie CPU i infrastruktury

LiveKit jako SFU głównie odbiera, szyfruje/deszyfruje, przetwarza pakiety i forwarduje media. Nie jest to typowy transcoder dla każdego uczestnika, więc CPU zależy mocno od liczby tracków, subskrypcji i pakietów na sekundę, a nie tylko od liczby użytkowników.

| **Wariant**                                           | **Rekomendacja startowa**                                           | **Komentarz**                                                                                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **MVP: 5x100, Trener audio + kamera 720p**            | **1 node compute-optimized 8-16 vCPU, 16-32 GB RAM, szybki uplink** | **Orientacyjnie powinno być bezpieczne, bo ruch jest głównie one-to-many i poniżej 1 Gbps z narzutem. Wymagany realny load test.** |
| **MVP: 5x100, kamera 720p + screen share**            | **1 node 16 vCPU albo 2 mniejsze nody, 10Gbps NIC preferowane**     | **Około 2.1 Gbps peak. Nadal typ webinarowy, ale większy outbound.**                                                               |
| **Audio wielu Obserwatorów**                          | **8-16 vCPU; limit aktywnych mówców**                               | **CPU i pakiety rosną z liczbą publikujących audio. UX też wymaga moderacji.**                                                     |
| **Future: 100 kamer z paginacją do 9, 720p, 5 sesji** | **Nie pakować na mały VPS; minimum 10Gbps i kilka nodeów 16 vCPU**  | **Około 9.3 Gbps peak. Room musi zmieścić się na jednym node, ale 5 różnych roomów można rozłożyć między nody.**                   |

**Rekomendacja wdrożeniowa: produkcyjnie mierzyć CPU, packet loss, RTT, publish/subscriber bitrate, reconnecty i outbound per room. Autoscaling/rozłożenie roomów wymaga Redis i konfiguracji multi-node.**

### 14.7 Optymalizacje LiveKit wymagane w implementacji

Włączyć adaptive stream/selective subscriptions, żeby klient odbierał tylko potrzebne tracki.

Używać paginacji gridu video, jeżeli kiedykolwiek pojawi się tryb wielu kamer.

Włączyć/utrzymać simulcast dla video, żeby LiveKit mógł dobrać właściwą warstwę jakości.

Rozważyć dynacast, żeby nie publikować warstw video, których nikt nie konsumuje.

Dla webinar mode nie subskrybować żadnych tracków Obserwatorów poza mikrofonem, gdy toggle jest ON.

Dodać limity jakości: np. kamera Trenera domyślnie 720p, screen share 1080p, audio speech bez trybu hi-fi.

Nie włączać nagrywania/Egress w tych kalkulacjach. Recording będzie osobnym kosztem CPU/transferu/storage.

### 14.8 Źródła techniczne i ograniczenia kalkulacji

LiveKit docs: self-hosting deployment mówi, że skalowanie jest ograniczone głównie przez CPU i bandwidth oraz rekomenduje produkcyjnie 10Gbps ethernet lub szybciej.

LiveKit docs: benchmarki pokazują przykładowe wyniki na 16-core compute-optimized instancji Google Cloud c2-standard-16.

LiveKit docs: benchmark livestreaming 1 publisher / 3000 subscribers osiąga około 92% CPU na c2-standard-16 przy 720p.

LiveKit docs: benchmark large meeting 150 publishers / 150 subscribers osiąga około 85% CPU na c2-standard-16.

LiveKit docs: media subscription limits wskazują limit 100 video i 100 audio tracków na uczestnika oraz zalecają paginację/selective subscriptions dla dużej liczby video.

Wartości w tabelach są modelowaniem planistycznym, nie gwarancją. Finalna decyzja infrastrukturalna powinna wynikać z load testu na docelowym providerze i konfiguracji.

## 15. Kryteria akceptacji

W LMS istnieje osobny widok Kalendarza dostępny dla Trenera, Content Creatora, Administratora i Obserwatora.

Kalendarz zawiera widoczne dla użytkownika Szkolenia na Żywo.

Obserwator widzi i może dołączyć tylko do szkoleń, do których został przypisany.

Dzisiejszy dzień jest podświetlony w kalendarzu.

Jeśli użytkownik ma dzisiaj Live Training, Kalendarz w lewym sidebarze posiada indicator.

Jeśli Live Training trwa, system wyświetla popup szybkiego dołączenia dla uprawnionych użytkowników tylko raz na sesję/użytkownika.

Dismiss popupu jest zapisywany w localStorage; stan bieżący może być obsługiwany przez Zustand.

Content Creator może stworzyć i edytować swoje szkolenie, wskazując siebie jako Trenera.

Content Creator może zlinkować swoje szkolenie Live do swojego kursu.

Administrator może stworzyć i edytować szkolenie oraz przypisać lub zmienić Trenera.

Administrator może dodać nowe szkolenie Live do kursu albo zlinkować istniejące szkolenie Live z kursem.

Szkolenie Live zlinkowane z kursem jest traktowane jako normalna osobna lekcja.

Szkolenie Live może istnieć bez linku do kursu.

Trener może rozpocząć sesję, a LMS tworzy/aktywuje meeting w LiveKit.

Trener może zakończyć sesję, a meeting w LiveKit zostaje zamknięty lub rozłączony zgodnie z integracją.

Obserwatorzy mogą słuchać i oglądać sesję.

Dostęp Obserwatorów do mikrofonu jest kontrolowany togglem ustawianym wyłącznie przed startem szkolenia.

Gdy toggle mikrofonu jest OFF, Obserwatorzy nie mogą mówić przez mikrofon.

Gdy toggle mikrofonu jest ON, Obserwatorzy mogą używać mikrofonu, ale nadal nie mogą udostępniać ekranu, kontrolować prezentacji ani edytować materiałów.

Materiały PPTX są obsługiwane bezpośrednio.

System przechowuje status sesji: scheduled/waiting/active/ended/cancelled/expired.

System zbiera informacje o obecności i czasie uczestnictwa.

Zakończenie szkolenia przez Trenera automatycznie zalicza lekcję w kursie wszystkim przypisanym uczestnikom, jeśli szkolenie jest lekcją kursową.

Usuwanie szkolenia odbywa się zgodnie z regułami usuwania lekcji/wydarzenia, zależnie od tego, czy szkolenie jest zlinkowane z kursem, czy niezależne.

## 16. Decyzje podjęte i pozostałe do ustalenia

| **Temat**                   | **Decyzja**                                                                                                                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Meeting provider**        | **Korzystamy z LiveKit.**                                                                                                                                                                                                 |
| **Mikrofon Obserwatorów**   | **Toggle ustawiany tylko przed startem szkolenia, podczas tworzenia/edycji eventu przed rozpoczęciem.**                                                                                                                   |
| **Popup aktywnej sesji**    | **Popup pojawia się raz na sesję/użytkownika. Dismiss zapisujemy w localStorage; Zustand może trzymać bieżący stan UI.**                                                                                                  |
| **Automatyczne zaliczenie** | **Zaliczamy wszystkich przypisanych uczestników po zakończeniu szkolenia przez Trenera. Obecność jest raportowa.**                                                                                                        |
| **Tworzenie i linkowanie**  | **Tylko Administrator i Content Creator. Content Creator może tworzyć swoje szkolenie, linkować je do swojego kursu i wskazać siebie jako Trenera. Administrator może zarządzać wszystkimi i wskazać dowolnego Trenera.** |
| **Usuwanie szkoleń**        | **Tak jak usuwanie lekcji/wydarzenia: zlinkowane szkolenie według reguł lekcji kursowej, niezależne według reguł niezależnego wydarzenia/szkolenia.**                                                                     |
| **Materiały PPTX**          | **PPTX obsługiwany bezpośrednio. Brak obowiązkowej konwersji do PDF/obrazów w MVP.**                                                                                                                                      |
| **Równoległe szkolenia**    | **Pozostaje do ustalenia: maksymalny globalny limit równoległych sesji.**                                                                                                                                                 |

_Dokument przygotowany jako specyfikacja produktowo-techniczna do implementacji Live Trainings._
