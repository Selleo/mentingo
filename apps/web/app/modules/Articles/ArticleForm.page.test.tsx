import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { ARTICLE_FORM_PAGE_HANDLES } from "../../../e2e/data/articles/handles";

import ArticleFormPage from "./ArticleForm.page";

const getArticle = vi.fn();

vi.mock("@remix-run/react", () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ articleId: "article-1" }),
}));
vi.mock("~/api/api-client", () => ({
  ApiClient: { api: { articlesControllerGetArticle: (...args: unknown[]) => getArticle(...args) } },
}));
vi.mock("~/api/mutations/admin/useDeleteArticleLanguage", () => ({
  useDeleteArticleLanguage: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("~/api/mutations/admin/useInitVideoUpload", () => ({
  useInitVideoUpload: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("~/api/mutations/usePreviewArticle", () => ({
  usePreviewArticle: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("~/api/mutations/useUpdateArticle", () => ({
  useUpdateArticle: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("~/hooks/useEntityResourceUpload", () => ({
  useEntityResourceUpload: () => ({ uploadResource: vi.fn() }),
}));
vi.mock("~/hooks/useTusVideoUpload", () => ({
  useTusVideoUpload: () => ({ getSessionForFile: vi.fn(), uploadVideo: vi.fn() }),
}));
vi.mock("~/hooks/useUploadDisplayModeDialog", () => ({
  useUploadDisplayModeDialog: () => ({ askForDisplayMode: vi.fn(), dialog: null }),
}));
vi.mock("~/components/PageWrapper", () => ({
  PageWrapper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("./LanguageSelector", () => ({ ArticleLanguageSelector: () => null }));
vi.mock("../Dashboard/Settings/Language/LanguageStore", () => ({
  useLanguageStore: () => ({ language: "en" }),
}));

const buildArticle = (overrides = {}) => ({
  id: "article-1",
  title: "Existing title",
  summary: "Existing summary",
  plainContent: "<p>Existing content</p>",
  content: "<p>Existing content</p>",
  isPublic: true,
  baseLanguage: "en",
  availableLocales: ["en"],
  resources: {},
  ...overrides,
});

describe("ArticleFormPage", () => {
  it("prefills the form with the persisted article", async () => {
    getArticle.mockResolvedValue({ data: { data: buildArticle() } });

    renderWith()
      .withQuery()
      .render(
        <StrictMode>
          <ArticleFormPage />
        </StrictMode>,
      );

    await waitFor(() =>
      expect(screen.getByTestId(ARTICLE_FORM_PAGE_HANDLES.TITLE_INPUT)).toHaveValue(
        "Existing title",
      ),
    );
    expect(screen.getByTestId(ARTICLE_FORM_PAGE_HANDLES.SUMMARY_INPUT)).toHaveValue(
      "Existing summary",
    );
    await waitFor(() =>
      expect(document.querySelector(".ProseMirror")).toHaveTextContent("Existing content"),
    );
  });

  it("prefills the form when reopened while the cached article refetches", async () => {
    getArticle.mockResolvedValue({ data: { data: buildArticle() } });
    const client = new QueryClient();
    const ui = (
      <QueryClientProvider client={client}>
        <StrictMode>
          <ArticleFormPage />
        </StrictMode>
      </QueryClientProvider>
    );

    const first = render(ui);
    await waitFor(() =>
      expect(screen.getByTestId(ARTICLE_FORM_PAGE_HANDLES.TITLE_INPUT)).toHaveValue(
        "Existing title",
      ),
    );
    first.unmount();

    render(ui);
    await waitFor(() =>
      expect(screen.getByTestId(ARTICLE_FORM_PAGE_HANDLES.TITLE_INPUT)).toHaveValue(
        "Existing title",
      ),
    );
    await waitFor(() =>
      expect(document.querySelector(".ProseMirror")).toHaveTextContent("Existing content"),
    );
  });
});
