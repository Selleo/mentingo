import { useParams } from "@remix-run/react";
import { formatDate } from "date-fns";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { Icon } from "../../components/Icon";
import { PageWrapper } from "../../components/PageWrapper";
import Viewer from "../../components/RichText/Viever";

import { NewsEmbed } from "./components/NewsEmbed";
import { NewsFile } from "./components/NewsFile";
import { NewsPhoto } from "./components/NewsPhoto";
import { NewsVideo } from "./components/NewsVideo";

type NewsContentBlock =
  | { id: string; type: "text"; content: string; description?: string }
  | { id: string; type: "file"; name: string; url: string; meta?: string; description?: string }
  | { id: string; type: "photo"; alt: string; url: string; description?: string }
  | {
      id: string;
      type: "video";
      url: string;
      isExternal?: boolean;
      title?: string;
      duration?: string;
      description?: string;
    }
  | {
      id: string;
      type: "embed";
      url: string;
      allowFullscreen?: boolean;
      title?: string;
      description?: string;
    };

type NewsEntry = {
  id: string;
  title: string;
  intro: string;
  date: string;
  author: string;
  headerImage: string;
  content: NewsContentBlock[];
};

const mockNews: NewsEntry[] = [
  {
    id: "1",
    title: "Nowe zagrożenie ransomware uderza w firmy",
    intro: "Jak działa nowa kampania, jakie są techniki ataku i jak się chronić.",
    date: "2024-12-08",
    author: "CERT Polska",
    headerImage: "https://picsum.photos/id/1043/1600/600",
    content: [
      {
        id: "1-text",
        type: "text",
        content:
          "<h2>Jak działa nowe zagrożenie?</h2><p>Cybeprzestępcy wykorzystują lukę zero-day w popularnym oprogramowaniu księgowym. Atak rozpoczyna się od spersonalizowanego phishingu, w którym ofiara otrzymuje pozornie legalną fakturę.</p><h3>Główne etapy ataku</h3><p>1) Dostarczenie złośliwego załącznika, 2) Uruchomienie makra i pobranie payloadu, 3) Szyfrowanie danych i wyświetlenie żądania okupu. Każdy krok jest automatyzowany i trudny do wykrycia bez EDR.</p>",
      },
      {
        id: "1-photo",
        type: "photo",
        alt: "Nowoczesne centrum danych zabezpieczone przed atakami ransomware",
        description: "Nowoczesne centrum danych zabezpieczone przed atakami ransomware",
        url: "https://picsum.photos/id/1027/1200/675",
      },
      {
        id: "1-photo-2",
        type: "photo",
        alt: "Wielowarstwowa ochrona sieci korporacyjnej",
        description: "Wielowarstwowa ochrona sieci korporacyjnej",
        url: "https://picsum.photos/id/1050/1200/675",
      },
      {
        id: "1-text-2",
        type: "text",
        content:
          "<h3>Szczegółowa analiza techniczna</h3><p>Eksperci przeprowadzili dogłębną analizę kodu malware. Poniżej materiał wideo wyjaśniający mechanizm działania: wykorzystanie AES do szyfrowania plików oraz RSA do zabezpieczenia klucza.</p>",
      },
      {
        id: "1-video",
        type: "video",
        url: "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4",
        isExternal: true,
        description: "Webinar: Analiza nowoczesnych ataków ransomware (45 min)",
      },
      {
        id: "1-text-3",
        type: "text",
        content:
          "<h3>Techniki wykorzystywane przez atakujących</h3><ul><li><strong>Spear phishing</strong> generowany przez AI.</li><li><strong>Lateral movement</strong> przez sieć firmową.</li><li><strong>Podwójne wymuszenie</strong>: kradzież i szyfrowanie danych.</li><li><strong>Unikanie detekcji</strong>: wyłączenie popularnych AV/EDR.</li></ul><h3>Dokumentacja techniczna</h3><p>Poniżej zamieszczamy raport techniczny i checklistę zabezpieczeń dla zespołów IT.</p>",
      },
      {
        id: "1-file-raport",
        type: "file",
        name: "Raport_Ransomware_CryptoLock_2025.pdf",
        url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
        meta: "PDF • 2.4 MB",
      },
      {
        id: "1-file-checklist",
        type: "file",
        name: "Checklist_Zabezpieczen.xlsx",
        url: "https://file-examples.com/storage/fe0d1166003c4bf20e504e9/2017/02/file_example_XLSX_10.xlsx",
        meta: "XLSX • 159 KB",
      },
    ],
  },
  {
    id: "2",
    title: "Sample news with video",
    intro: "Another entry showing media blocks.",
    date: "2024-11-30",
    author: "Redakcja Mentingo",
    headerImage: "https://picsum.photos/id/1005/1600/600",
    content: [
      {
        id: "2-video",
        type: "video",
        url: "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4",
        isExternal: true,
      },
      {
        id: "2-photo",
        type: "photo",
        alt: "Wielowarstwowa ochrona sieci korporacyjnej",
        description: "Wielowarstwowa ochrona sieci korporacyjnej",
        url: "https://images.unsplash.com/photo-1517242440400-59b8157b1cf2?auto=format&fit=crop&w=1200&q=80",
      },
      {
        id: "2-text",
        type: "text",
        content:
          "<h3>Jak się chronić?</h3><ul><li><strong>Aktualizacja systemów</strong> — włącz automatyczne poprawki.</li><li><strong>Backup 3-2-1</strong> — trzy kopie, dwie różne lokalizacje, jedna offline.</li><li><strong>Segmentacja sieci</strong> — oddziel krytyczne systemy.</li><li><strong>Szkolenia phishing</strong> — regularne kampanie uświadamiające.</li><li><strong>Zero Trust</strong> — weryfikuj każde połączenie.</li></ul><h3>Dodatkowe materiały szkoleniowe</h3><p>Pobierz podręcznik cyberbezpieczeństwa oraz checklisty dla zespołów.</p>",
      },
      {
        id: "2-file-guide",
        type: "file",
        name: "Podrecznik_Cyberbezpieczenstwa_2025.pdf",
        url: "https://example.com/Podrecznik_Cyberbezpieczenstwa_2025.pdf",
      },
    ],
  },
];

export default function NewsDetailsPage() {
  const { t } = useTranslation();
  const { newsId } = useParams();

  const news = mockNews.find((item) => item.id === newsId);

  if (!news) {
    return (
      <PageWrapper>
        <div className="py-10 text-center text-neutral-700">{t("newsView.notFound")}</div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper
      breadcrumbs={[
        { title: t("navigationSideBar.dashboard"), href: "/" },
        { title: t("navigationSideBar.news"), href: "/news" },
        { title: news.title, href: `/news/${news.id}` },
      ]}
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-8">
        <img src={news.headerImage} alt={news.title} className="w-full h-[500px] rounded-lg" />

        <div className="flex flex-col gap-4 border-b-[1px] border-primary-100 pb-3">
          <h1 className="text-[42px] font-bold text-neutral-950 leading-10">{news.title}</h1>
          <p className="text-lg font-normal text-neutral-800 leading-7">{news.intro}</p>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Icon name="Calendar" className="text-neutral-600 size-4" />
              <p className="text-sm font-normal leading-5 text-neutral-600">
                {formatDate(news.date, "d MMMM yyyy")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="User" className="text-neutral-600 size-4" />
              <p className="text-sm font-normal leading-5 text-neutral-600">{news.author}</p>
            </div>
          </div>
        </div>
      </div>

      <header className="space-y-3">
        <p className="subtle text-neutral-700">{news.intro}</p>
      </header>

      <div className="flex flex-col gap-6">
        {news.content.map((block) =>
          match(block)
            .with({ type: "text" }, (b) => <Viewer variant="lesson" content={b.content} />)
            .with({ type: "photo" }, (b) => (
              <NewsPhoto key={b.id} alt={b.alt} url={b.url} description={b.description} />
            ))
            .with({ type: "file" }, (b) => (
              <NewsFile key={b.id} name={b.name} url={b.url} meta={b.meta} />
            ))
            .with({ type: "video" }, (b) => (
              <NewsVideo
                key={b.id}
                url={b.url}
                isExternal={b.isExternal}
                description={b.description}
              />
            ))
            .with({ type: "embed" }, (b) => (
              <NewsEmbed
                key={b.id}
                url={b.url}
                allowFullscreen={b.allowFullscreen}
                title={b.title}
              />
            ))
            .exhaustive(),
        )}
      </div>

      <div className="border-b border-primary-100" />

      <div className="flex items-center justify-between pb-14">
        <button
          className="flex items-center gap-2 disabled:opacity-50"
          onClick={() => {
            // navigate(`/news/id`);
          }}
          disabled={false}
        >
          <Icon name="ChevronLeft" className="size-5 text-neutral-800" />
          <span className="text-sm font-semibold leading-5 text-neutral-800">
            {t("newsView.previousArticle")}
          </span>
        </button>
        <button
          className="flex items-center gap-2 disabled:opacity-50"
          onClick={() => {
            // navigate(`/news/id`);
          }}
          disabled={true}
        >
          <span className="text-sm font-semibold leading-5 text-neutral-800">
            {t("newsView.nextArticle")}
          </span>
          <Icon name="ChevronRight" className="size-5 text-neutral-800" />
        </button>
      </div>
    </PageWrapper>
  );
}
