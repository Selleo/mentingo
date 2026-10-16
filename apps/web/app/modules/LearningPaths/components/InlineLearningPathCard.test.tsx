import { cleanup, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import i18next from "~/utils/mocks/i18next.mock";
import { renderWith } from "~/utils/testUtils";

import { InlineLearningPathCard } from "./InlineLearningPathCard";

import type { SupportedLanguages } from "@repo/shared";
import type { GetLearningPathByIdResponse, GetLearningPathsResponse } from "~/api/generated-api";

const localized = vi.hoisted(() => ({
  response: undefined as GetLearningPathByIdResponse | undefined,
}));
vi.mock("~/api/queries/useLearningPaths", () => ({
  useLearningPath: () => ({ data: localized.response }),
}));
vi.mock("./LearningPathCardActions", () => ({ LearningPathCardActions: () => null }));
vi.mock("./LearningPathCoursesSection", () => ({ LearningPathCoursesSection: () => null }));
vi.mock("~/modules/Admin/LearningPaths/LearningPathLanguageSelector", () => ({
  LearningPathLanguageSelector: () => null,
}));

const description =
  "First paragraph of the complete path description.\n\n" + "Full details. ".repeat(80);
const learningPath: GetLearningPathsResponse["data"][number] = {
  id: "path-1",
  title: "Example learning path",
  description,
  thumbnailReference: null,
  isEnrolled: false,
  status: "published",
  includesCertificate: false,
  settings: { certificateSignatureUrl: null, certificateFontColor: null },
  sequenceEnabled: false,
  authorId: "author-1",
  baseLanguage: "en",
  availableLocales: ["en"],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  courses: [],
  availableCourseOptions: [],
};

const renderCard = (
  canEdit: boolean,
  onUpdate = vi.fn().mockResolvedValue(undefined),
  selectedLanguage: SupportedLanguages = "en",
) =>
  renderWith().render(
    <InlineLearningPathCard
      learningPath={learningPath}
      canEdit={canEdit}
      canUpdateCourses={false}
      canDelete={false}
      canManageEnrollment={false}
      currentLanguage="en"
      selectedLanguage={selectedLanguage}
      onLanguageChange={() => {}}
      onUpdate={onUpdate}
      onDelete={() => {}}
      onAddCourses={async () => {}}
      onRemoveCourse={async () => {}}
      onReorderCourses={async () => {}}
      groupOptions={[]}
    />,
  );

describe("InlineLearningPathCard details", () => {
  afterEach(async () => {
    cleanup();
    localized.response = undefined;
    await i18next.changeLanguage("en");
  });

  it("uses the exact Polish details label", async () => {
    await i18next.changeLanguage("pl");
    renderCard(false);
    await userEvent.click(screen.getByRole("button", { name: "Szczegóły ścieżki" }));
    expect(screen.getByRole("dialog", { name: "Szczegóły ścieżki" })).toBeInTheDocument();
  });

  it("opens and saves the selected translation rather than the list language", async () => {
    const user = userEvent.setup();
    localized.response = {
      data: {
        ...learningPath,
        title: "Polski tytuł",
        description: "Pełny polski opis",
        progress: "not_started",
        progressValue: 0,
        completedCourseCount: 0,
        totalCourseCount: 0,
        certificateReady: false,
        courses: [],
      },
    };
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    renderCard(true, onUpdate, "pl");
    await user.click(screen.getByRole("button", { name: "Learning path details" }));
    expect(screen.getByRole("heading", { name: "Polski tytuł" })).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("Pełny polski opis");
    await user.type(screen.getByRole("textbox"), " — zmiana");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(onUpdate).toHaveBeenCalledWith({
      description: "Pełny polski opis — zmiana",
      language: "pl",
    });
  });

  it("reports a failed save and keeps the draft available for retry", async () => {
    const user = userEvent.setup();
    const onUpdate = vi
      .fn()
      .mockRejectedValueOnce(new Error("Save failed"))
      .mockResolvedValue(undefined);
    renderCard(true, onUpdate);
    await user.click(screen.getByRole("button", { name: "Learning path details" }));
    await user.clear(screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), "Retained draft");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.getByRole("textbox")).toHaveValue("Retained draft");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("saves the full multiline description in the selected language from details", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    renderCard(true, onUpdate);
    await user.click(screen.getByRole("button", { name: "Learning path details" }));
    const editor = screen.getByRole("textbox", { name: "Description" });
    await user.clear(editor);
    await user.type(editor, "Updated description{Enter}Second paragraph");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(onUpdate).toHaveBeenCalledWith({
      description: "Updated description\nSecond paragraph",
      language: "en",
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Learning path details" }));
    expect(screen.getByRole("textbox")).toHaveValue("Updated description\nSecond paragraph");
  });
  it.each([false, true])(
    "hides the teaser and opens complete details (canEdit=%s)",
    async (canEdit) => {
      const user = userEvent.setup();
      renderCard(canEdit);

      expect(screen.queryByText(/First paragraph/)).not.toBeInTheDocument();
      const trigger = screen.getByRole("button", { name: "Learning path details" });
      expect(trigger).toHaveClass("max-w-full", "whitespace-normal");
      await user.click(trigger);

      const dialog = screen.getByRole("dialog", { name: "Learning path details" });
      expect(
        within(dialog).queryByRole("button", { name: /course details/i }),
      ).not.toBeInTheDocument();
      if (canEdit) {
        expect(within(dialog).getByRole("textbox")).toHaveValue(description);
      } else {
        expect(within(dialog).getByText(/First paragraph/).textContent).toBe(description);
        expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
      }
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    },
  );
});
