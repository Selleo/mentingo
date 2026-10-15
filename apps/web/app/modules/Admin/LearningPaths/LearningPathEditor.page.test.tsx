import { createRemixStub } from "@remix-run/testing";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Suspense } from "react";

import { ApiClient } from "~/api/api-client";

import LearningPathEditorPage from "./LearningPathEditor.page";

import type { SupportedLanguages } from "@repo/shared";
import type { ReactNode } from "react";

vi.mock("~/api/api-client", () => ({
  ApiClient: { api: { learningPathControllerGetLearningPathById: vi.fn() } },
}));
vi.mock("~/api/queries", () => ({
  useCurrentUserSuspense: () => ({ data: { id: "user-1" } }),
}));
vi.mock("~/Guards/RequireAuthenticatedUser", () => ({
  RequireAuthenticatedUser: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("~/hooks/usePermissions", () => ({ usePermissions: () => ({ permissions: [] }) }));
vi.mock("~/modules/Dashboard/Settings/Language/LanguageStore", () => ({
  useLanguageStore: (selector: (state: { language: SupportedLanguages }) => unknown) =>
    selector({ language: "en" }),
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("~/components/PageWrapper", () => ({
  PageWrapper: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("./components/LearningPathEditorForm", () => ({
  LearningPathEditorForm: ({
    isCreateMode,
    editorLanguage,
    learningPath,
    languageSelectorProps,
  }: {
    isCreateMode: boolean;
    editorLanguage: SupportedLanguages;
    learningPath: { title: string } | null;
    languageSelectorProps: { onChange: (language: SupportedLanguages) => void };
  }) => (
    <div>
      <span>{isCreateMode ? "Create path" : learningPath?.title}</span>
      <span>Language: {editorLanguage}</span>
      <button onClick={() => languageSelectorProps.onChange("en")}>English</button>
    </div>
  ),
}));

function renderEditor(path: string) {
  const RemixStub = createRemixStub([
    { path: "/admin/development-paths/new", Component: LearningPathEditorPage },
    { path: "/admin/development-paths/:id", Component: LearningPathEditorPage },
  ]);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<div>Loading path</div>}>
        <RemixStub initialEntries={[path]} />
      </Suspense>
    </QueryClientProvider>,
  );
}

describe("LearningPathEditorPage suspense data", () => {
  beforeEach(() => {
    vi.mocked(ApiClient.api.learningPathControllerGetLearningPathById).mockReset();
  });

  it("creates a path without requesting the new pseudo-ID", () => {
    renderEditor("/admin/development-paths/new");

    expect(screen.getByText("Create path")).toBeInTheDocument();
    expect(screen.getByText("Language: en")).toBeInTheDocument();
    expect(ApiClient.api.learningPathControllerGetLearningPathById).not.toHaveBeenCalled();
  });

  it("initializes editing in the base language and waits for the selected locale", async () => {
    const getPath = vi.mocked(ApiClient.api.learningPathControllerGetLearningPathById);
    getPath.mockImplementation(
      async (_id, params) =>
        ({
          data: {
            data: {
              id: "path-1",
              baseLanguage: "pl",
              availableLocales: ["pl", "en"],
              title: params?.language === "pl" ? "Polska ścieżka" : "English path",
              description: "",
            },
          },
        }) as Awaited<ReturnType<typeof ApiClient.api.learningPathControllerGetLearningPathById>>,
    );

    renderEditor("/admin/development-paths/path-1");

    expect(await screen.findByText("Polska ścieżka")).toBeInTheDocument();
    expect(screen.getByText("Language: pl")).toBeInTheDocument();
    await waitFor(() => expect(getPath).toHaveBeenCalledWith("path-1", { language: "pl" }));

    fireEvent.click(screen.getByRole("button", { name: "English" }));

    expect(await screen.findByText("English path")).toBeInTheDocument();
    expect(screen.getByText("Language: en")).toBeInTheDocument();
  });
});
