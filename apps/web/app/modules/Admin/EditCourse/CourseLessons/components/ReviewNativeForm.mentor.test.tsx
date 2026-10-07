import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LeaveModalProvider } from "~/context/LeaveModalContext";
import i18next from "~/utils/mocks/i18next.mock";
import { renderWith } from "~/utils/testUtils";

import { renderReviewNativeForm } from "./ReviewNativeForm";

import type { ReviewLessonNode } from "~/modules/CourseAuthoring/review/curriculumReview.types";

vi.mock("@remix-run/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@remix-run/react")>()),
  useParams: () => ({ id: "course-1" }),
}));
vi.mock("~/api/queries/useLumaConfigured", () => ({
  useLumaConfigured: () => ({ data: { voiceMentorEnabled: false } }),
}));
const savedConfigurationQuery = vi.fn((_lessonId: string, _language: string) => ({
  data: undefined,
  isLoading: false,
}));
vi.mock("~/api/queries/admin/useAiMentorConfiguration", () => ({
  useAiMentorConfiguration: (lessonId: string, language: string) =>
    savedConfigurationQuery(lessonId, language),
}));
vi.mock("~/api/queries/admin/useAiJudgeConfiguration", () => ({
  useAiJudgeConfiguration: (lessonId: string, language: string) =>
    savedConfigurationQuery(lessonId, language),
}));

const node: ReviewLessonNode = {
  nodeType: "lesson",
  id: "lesson-new",
  chapterId: "chapter-1",
  title: "Handle a tough customer call",
  previousTitle: null,
  lessonType: "ai_mentor",
  kind: "added",
  movedFrom: null,
  current: null,
  proposalIds: ["proposal-1"],
  operations: [
    {
      operationId: "operation-1",
      targetId: "lesson-new",
      type: "lesson.create",
      dependencies: [],
      payload: {
        lessonType: "ai_mentor",
        title: "Handle a tough customer call",
        description: "<p>Calm an upset customer.</p>",
        name: "Alex",
        configurationType: "roleplay",
        configuration: {
          scenario: "A delayed delivery",
          aiRole: "Upset customer",
          learnerRole: "Support agent",
          characterGoal: "Get a clear next step",
          difficulty: "medium",
          factsAndConstraints: null,
          openingInstruction: null,
          additionalInstructions: null,
        },
        judgeConfiguration: {
          taskGoal: "De-escalate the call",
          passingThresholdPercent: 70,
          criteria: [
            {
              ref: "C1",
              title: "Empathy",
              expectedBehavior: "Acknowledges the frustration",
              maxScore: 2,
              scoreGuidance: [],
            },
          ],
          blockingErrors: [],
        },
        sourceVersionIds: [],
        avatarAssetId: null,
        preparedResourceIds: [],
      },
    },
  ],
};

describe("renderReviewNativeForm for an AI Mentor lesson", () => {
  beforeEach(async () => {
    await i18next.changeLanguage("en");
    savedConfigurationQuery.mockClear();
  });

  it("shows the editor's own Mentor form read-only with the proposed configuration", async () => {
    renderWith({ withQuery: true }).render(
      <LeaveModalProvider>{renderReviewNativeForm(node, "en", "en")}</LeaveModalProvider>,
    );

    expect(screen.getByTestId("course-authoring-review-native-form")).toBeVisible();
    expect(screen.getByText("Handle a tough customer call")).toBeVisible();
    expect(screen.queryByText(/Edit:/)).toBeNull();
    expect(screen.getByDisplayValue("Alex")).toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: "Create with AI" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Test AI Mentor" })).toBeNull();
    expect(savedConfigurationQuery).toHaveBeenCalledWith("", "en");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "View assessment" }));
    const dialog = await screen.findByTestId("curriculum-ai-mentor-judge-dialog");
    const readOnlyAssessment = within(dialog).getByTestId("curriculum-ai-mentor-judge-read-only");
    expect(readOnlyAssessment).toHaveTextContent("De-escalate the call");
    expect(readOnlyAssessment).toHaveTextContent("Empathy");
    expect(within(dialog).queryByTestId("curriculum-ai-mentor-judge-apply-button")).toBeNull();
  });

  it.each([false, true])("shows actual Mentor reference files (targeted: %s)", (targeted) => {
    const sourceBackedNode: ReviewLessonNode = {
      ...node,
      operations: [
        {
          ...node.operations[0],
          payload: {
            ...node.operations[0].payload,
            sourceVersionIds: ["source-1"],
          },
        },
      ],
    };

    renderWith({ withQuery: true }).render(
      <LeaveModalProvider>
        {renderReviewNativeForm(sourceBackedNode, "en", "en", undefined, {
          targetedMentorOperationIds: targeted ? ["operation-1"] : [],
          sources: [
            {
              id: "source-1",
              name: "support-guide.pdf",
              status: "ready",
              selected: true,
              mediaType: "application/pdf",
              readableSections: 3,
              totalSections: 3,
              warning: null,
              sections: [],
            },
          ],
        })}
      </LeaveModalProvider>,
    );

    expect(screen.getByText("Additional context")).toBeVisible();
    if (targeted) {
      expect(screen.getByText("Handle a tough customer call.txt")).toBeVisible();
      expect(screen.queryByText("support-guide.pdf")).not.toBeInTheDocument();
    } else {
      expect(screen.getByText("support-guide.pdf")).toBeVisible();
      expect(screen.getByText("PDF")).toBeVisible();
    }
    expect(screen.queryByRole("button", { name: "Remove file" })).not.toBeInTheDocument();
  });
});
