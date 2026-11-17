import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { screen } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { server } from "~/utils/mocks/node";

import { FixtureApiClient } from "./api-client";

type RecordedSpy = { mock: { calls: unknown[][]; invocationCallOrder: number[] } };

/** Last argument of every call (body or query), in the order the calls happened across spies. */
const recordedPayloads = (...spies: RecordedSpy[]) =>
  spies
    .flatMap((spy) =>
      spy.mock.calls.map((args, index) => ({
        order: spy.mock.invocationCallOrder[index],
        payload: args.at(-1),
      })),
    )
    .sort((first, second) => first.order - second.order)
    .map(({ payload }) => payload);

/** Each language runs on freshly loaded modules, matching separate EN/PL scenario replays. */
describe.each([SUPPORTED_LANGUAGES.EN, SUPPORTED_LANGUAGES.PL])(
  "self-onboarding recording language %s",
  (language) => {
    const polish = language === SUPPORTED_LANGUAGES.PL;

    const loadContext = () => import("./self-onboarding-context");

    beforeEach(() => {
      vi.stubEnv("SELF_ONBOARDING_DEMO", "1");
      vi.stubEnv("SELF_ONBOARDING_LANGUAGE", language);
      vi.resetModules();
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      document.body.innerHTML = "";
    });

    it("native control selectors and example data agree with the recording language", async () => {
      const { getSelfOnboardingLanguage, recordingText, recordingValue } = await loadContext();
      expect(getSelfOnboardingLanguage()).toBe(language);
      const save = recordingText("common.button.save");
      expect(save).toBe(polish ? "Zapisz" : "Save");
      const title = recordingValue({
        en: "Customer support journey",
        pl: "Ścieżka obsługi klienta",
      });
      document.documentElement.lang = language;
      document.body.innerHTML = `<input aria-label="title"/><button>${save}</button>`;
      const user = userEvent.setup();
      await user.type(screen.getByLabelText("title"), title);
      await user.click(screen.getByRole("button", { name: save }));
      expect(screen.getByLabelText("title")).toHaveValue(
        polish ? "Ścieżka obsługi klienta" : "Customer support journey",
      );
    });

    it("missing native translation keys fail visibly instead of using an English fallback", async () => {
      const { recordingText } = await loadContext();
      expect(() => recordingText("selfOnboarding.doesNotExist")).toThrow(
        "Missing recording UI translation",
      );
    });

    it("article section prerequisites use the native recording language", async () => {
      const section = { id: "native-section", title: "Knowledge base" };
      server.use(
        http.post("*/api/articles/section", () => HttpResponse.json({ data: section })),
        http.patch("*/api/articles/section/:id", () => HttpResponse.json({ data: section })),
        http.get("*/api/articles/section/:id", () => HttpResponse.json({ data: section })),
      );
      const apiClient = new FixtureApiClient("http://localhost:3000");
      const createSpy = vi.spyOn(apiClient.api, "articlesControllerCreateArticleSection");
      const updateSpy = vi.spyOn(apiClient.api, "articlesControllerUpdateArticleSection");
      const getSpy = vi.spyOn(apiClient.api, "articlesControllerGetArticleSection");
      const { recordingValue } = await loadContext();
      const { ArticleFactory } = await import("../factories/article.factory");
      const title = recordingValue({ en: "Employee handbook", pl: "Poradnik pracownika" });
      await new ArticleFactory(apiClient).createSection({ title });
      expect(recordedPayloads(createSpy, updateSpy, getSpy)).toEqual([
        { language },
        { translations: [{ language, title }] },
        { language },
        { language },
      ]);
    });

    it("news prerequisites create native-language drafts and content", async () => {
      const post = { id: "native-news" };
      server.use(
        http.post("*/api/news", () => HttpResponse.json({ data: post })),
        http.patch("*/api/news/:id", () => HttpResponse.json({ data: post })),
        http.get("*/api/news/:id", () => HttpResponse.json({ data: post })),
      );
      const apiClient = new FixtureApiClient("http://localhost:3000");
      const createSpy = vi.spyOn(apiClient.api, "newsControllerCreateNews");
      const updateSpy = vi.spyOn(apiClient.api, "newsControllerUpdateNews");
      const getSpy = vi.spyOn(apiClient.api, "newsControllerGetNews");
      const { recordingValue } = await loadContext();
      const { NewsFactory } = await import("../factories/news.factory");
      const title = recordingValue({
        en: "Team learning update",
        pl: "Aktualności akademii zespołu",
      });
      const summary = recordingValue({
        en: "Explore our new program.",
        pl: "Poznaj nasz nowy program.",
      });
      const content = `<p>${summary}</p>`;
      await new NewsFactory(apiClient).create({
        title,
        summary,
        content,
        status: "draft",
        isPublic: false,
      });
      expect(recordedPayloads(createSpy, updateSpy, getSpy)).toEqual([
        { language },
        {
          translations: JSON.stringify([{ language, title, summary, content }]),
          status: "draft",
          isPublic: false,
        },
        { language },
        { language },
      ]);
    });
  },
);
