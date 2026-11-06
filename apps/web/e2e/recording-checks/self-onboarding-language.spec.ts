import { expect, test } from "@playwright/test";
import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { ArticleFactory } from "../factories/article.factory";
import { NewsFactory } from "../factories/news.factory";
import {
  getSelfOnboardingLanguage,
  recordingText,
  recordingValue,
} from "../utils/self-onboarding-context";

import type { FixtureApiClient } from "../utils/api-client";

/** Run in separate EN/PL processes, matching actual localized scenario replay. */
test("native control selectors and example data agree with the recording language", async ({
  page,
}) => {
  const language = getSelfOnboardingLanguage();
  const polish = language === SUPPORTED_LANGUAGES.PL;
  const save = recordingText("common.button.save");
  expect(save).toBe(polish ? "Zapisz" : "Save");
  const title = recordingValue({ en: "Customer support journey", pl: "Ścieżka obsługi klienta" });
  await page.setContent(
    `<html lang="${language}"><input aria-label="title"/><button>${save}</button></html>`,
  );
  await page.getByLabel("title", { exact: true }).fill(title);
  await page.getByRole("button", { name: save, exact: true }).click();
  await expect(page.getByLabel("title", { exact: true })).toHaveValue(
    polish ? "Ścieżka obsługi klienta" : "Customer support journey",
  );
});

test("missing native translation keys fail visibly instead of using an English fallback", () => {
  expect(() => recordingText("selfOnboarding.doesNotExist")).toThrow(
    "Missing recording UI translation",
  );
});

test("article section prerequisites use the native recording language", async () => {
  const calls: unknown[] = [];
  const section = { id: "native-section", title: "Knowledge base" };
  const apiClient = {
    api: {
      articlesControllerCreateArticleSection: async (body: unknown) => {
        calls.push(body);
        return { data: { data: section } };
      },
      articlesControllerUpdateArticleSection: async (_id: string, body: unknown) => {
        calls.push(body);
      },
      articlesControllerGetArticleSection: async (_id: string, query: unknown) => {
        calls.push(query);
        return { data: { data: section } };
      },
    },
  } as unknown as FixtureApiClient;
  const language = getSelfOnboardingLanguage();
  const title = recordingValue({ en: "Employee handbook", pl: "Poradnik pracownika" });
  await new ArticleFactory(apiClient).createSection({ title });
  expect(calls).toEqual([
    { language },
    { translations: [{ language, title }] },
    { language },
    { language },
  ]);
});

test("news prerequisites create native-language drafts and content", async () => {
  const calls: unknown[] = [];
  const post = { id: "native-news" };
  const apiClient = {
    api: {
      newsControllerCreateNews: async (body: unknown) => {
        calls.push(body);
        return { data: { data: post } };
      },
      newsControllerUpdateNews: async (_id: string, body: unknown) => {
        calls.push(body);
      },
      newsControllerGetNews: async (_id: string, query: unknown) => {
        calls.push(query);
        return { data: { data: post } };
      },
    },
  } as unknown as FixtureApiClient;
  const language = getSelfOnboardingLanguage();
  const title = recordingValue({ en: "Team learning update", pl: "Aktualności akademii zespołu" });
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
  expect(calls).toEqual([
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
