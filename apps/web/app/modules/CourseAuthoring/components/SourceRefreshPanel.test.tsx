import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { SourceRefreshPanel } from "./SourceRefreshPanel";

import type { SourcePolicy, SourceRefreshView, SourceView } from "../courseAuthoring.types";

const sourcePolicy: SourcePolicy = {
  sourceVersionIds: ["old-source"],
  webEnabled: false,
  generalKnowledgeEnabled: true,
  researchDepth: "standard",
  requiredSectionIds: ["old-required"],
  excludedSectionIds: [],
};

const replacementSource: SourceView = {
  id: "replacement-source",
  name: "Replacement.pdf",
  status: "ready",
  selected: false,
  mediaType: "application/pdf",
  readableSections: 1,
  totalSections: 1,
  warning: null,
  sections: [
    {
      id: "new-section",
      kind: "page",
      sequence: 0,
      status: "ready",
      issue: null,
      pageNumber: 1,
      label: "New section",
    },
  ],
};

const refresh: SourceRefreshView = {
  refreshId: "refresh-1",
  status: "needs_mapping",
  oldSourceVersionId: "old-source",
  replacementSourceVersionId: "replacement-source",
  affectedTaskIds: ["task-1"],
  affectedProposalIds: ["proposal-1"],
  unmappedSectionIds: ["old-required"],
  suggestedSourcePolicy: {
    ...sourcePolicy,
    sourceVersionIds: ["replacement-source"],
    requiredSectionIds: [],
  },
  sourcePolicy: null,
  coverageImpacts: [
    {
      taskId: "lesson-task-1",
      lessonId: null,
      lessonTitle: "Lesson one",
      sourceVersionIds: ["old-source"],
      requiredSectionIds: [],
      mappedRequiredSectionIds: [],
      mappedOutlineRequiredSectionIds: [],
      mappedExcludedSectionIds: [],
      unmappedSectionIds: [],
      updateEligible: true,
    },
  ],
  sequence: 2,
};

describe("SourceRefreshPanel", () => {
  it("requires an explicit clear or mapping before retrying the refresh", async () => {
    const user = userEvent.setup();
    const onRefreshSource = vi.fn();

    renderWith().render(
      <SourceRefreshPanel
        sourceRefreshes={[refresh]}
        sources={[replacementSource]}
        sourcePolicy={sourcePolicy}
        onRefreshSource={onRefreshSource}
      />,
    );

    expect(screen.getByText("task-1")).toBeVisible();
    const lessonCheckbox = screen.getByRole("checkbox", { name: "Lesson one" });
    expect(lessonCheckbox).toBeChecked();
    const resolveButton = screen.getByRole("button", { name: "Apply explicit mapping" });
    expect(resolveButton).toBeDisabled();

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: /Clear this/ }));
    expect(resolveButton).toBeEnabled();
    await user.click(resolveButton);

    expect(onRefreshSource).toHaveBeenCalledWith(
      "old-source",
      "replacement-source",
      expect.objectContaining({
        sourceVersionIds: ["replacement-source"],
        requiredSectionIds: [],
        excludedSectionIds: [],
      }),
      ["lesson-task-1"],
    );
  });

  it("sends only lesson tasks the author leaves selected", async () => {
    const user = userEvent.setup();
    const onRefreshSource = vi.fn();
    renderWith().render(
      <SourceRefreshPanel
        sourceRefreshes={[refresh]}
        sources={[replacementSource]}
        sourcePolicy={sourcePolicy}
        onRefreshSource={onRefreshSource}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: "Lesson one" }));
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: /Clear this/ }));
    await user.click(screen.getByRole("button", { name: "Apply explicit mapping" }));

    expect(onRefreshSource).toHaveBeenCalledWith(
      "old-source",
      "replacement-source",
      expect.any(Object),
      [],
    );
  });

  it("enables and selects a task when its blocking section is explicitly resolved", async () => {
    const user = userEvent.setup();
    const onRefreshSource = vi.fn();
    const blockedRefresh = {
      ...refresh,
      coverageImpacts: [
        {
          ...refresh.coverageImpacts![0],
          unmappedSectionIds: ["old-required"],
          updateEligible: false,
        },
      ],
    };
    renderWith().render(
      <SourceRefreshPanel
        sourceRefreshes={[blockedRefresh]}
        sources={[replacementSource]}
        sourcePolicy={sourcePolicy}
        onRefreshSource={onRefreshSource}
      />,
    );

    const lessonCheckbox = screen.getByRole("checkbox", { name: "Lesson one" });
    expect(lessonCheckbox).toBeDisabled();
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: /Clear this/ }));

    expect(lessonCheckbox).toBeEnabled();
    expect(lessonCheckbox).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Apply explicit mapping" }));
    expect(onRefreshSource).toHaveBeenCalledWith(
      "old-source",
      "replacement-source",
      expect.any(Object),
      ["lesson-task-1"],
    );
  });

  it("does not submit a stale mapping after the selected source changes", () => {
    const onRefreshSource = vi.fn();

    renderWith().render(
      <SourceRefreshPanel
        sourceRefreshes={[refresh]}
        sources={[replacementSource]}
        sourcePolicy={{ ...sourcePolicy, sourceVersionIds: ["another-source"] }}
        onRefreshSource={onRefreshSource}
      />,
    );

    expect(
      screen.getByText("The source selection changed. Review the current sources and try again."),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Apply explicit mapping" }),
    ).not.toBeInTheDocument();
    expect(onRefreshSource).not.toHaveBeenCalled();
  });

  it("closes a replacement selector from the same trigger and outside click", async () => {
    const user = userEvent.setup();
    renderWith().render(
      <SourceRefreshPanel
        sourceRefreshes={[refresh]}
        sources={[replacementSource]}
        sourcePolicy={sourcePolicy}
        onRefreshSource={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("combobox");
    await user.click(trigger);
    expect(screen.getByRole("listbox")).toBeVisible();
    await user.click(trigger);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await user.click(trigger);
    await user.click(document.body);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("blocks conflicting required and excluded mappings instead of silently removing one", async () => {
    const user = userEvent.setup();
    const onRefreshSource = vi.fn();
    renderWith().render(
      <SourceRefreshPanel
        sourceRefreshes={[{ ...refresh, unmappedSectionIds: ["old-required", "old-excluded"] }]}
        sources={[replacementSource]}
        sourcePolicy={{ ...sourcePolicy, excludedSectionIds: ["old-excluded"] }}
        onRefreshSource={onRefreshSource}
      />,
    );
    const choices = screen.getAllByRole("combobox");
    await user.click(choices[0]);
    await user.click(screen.getAllByRole("option", { name: /Map to New section/ })[0]);
    await user.click(choices[1]);
    await user.click(screen.getAllByRole("option", { name: /Map to New section/ })[0]);
    expect(screen.getByRole("button", { name: "Apply explicit mapping" })).toBeDisabled();
    expect(screen.getByText(/A section cannot be both required and excluded/)).toBeVisible();
    expect(onRefreshSource).not.toHaveBeenCalled();

    await user.click(choices[1]);
    await user.click(screen.getByRole("option", { name: /Clear this/ }));
    await user.click(screen.getByRole("button", { name: "Apply explicit mapping" }));
    expect(onRefreshSource).toHaveBeenCalledWith(
      "old-source",
      "replacement-source",
      expect.objectContaining({ requiredSectionIds: ["new-section"], excludedSectionIds: [] }),
      ["lesson-task-1"],
    );
  });
});
