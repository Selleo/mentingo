import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { AuthoringSourcePopover } from "./AuthoringSourcePopover";

import type { SourcePolicy, SourceView } from "../courseAuthoring.types";

const policy: SourcePolicy = {
  sourceVersionIds: ["source-1"],
  webEnabled: true,
  generalKnowledgeEnabled: false,
  researchDepth: "standard",
  requiredSectionIds: [],
  excludedSectionIds: [],
};

const sources: SourceView[] = [
  {
    id: "source-1",
    name: "Current guide.pdf",
    status: "ready",
    selected: true,
    mediaType: "application/pdf",
    readableSections: 1,
    totalSections: 1,
    warning: null,
    sections: [],
  },
  {
    id: "source-2",
    name: "Replacement guide.pdf",
    status: "ready",
    selected: false,
    mediaType: "application/pdf",
    readableSections: 1,
    totalSections: 1,
    warning: null,
    sections: [],
  },
];

describe("AuthoringSourcePopover", () => {
  it("keeps thinking depth out of the Sources popover", () => {
    renderWith().render(
      <AuthoringSourcePopover
        sources={sources}
        policy={policy}
        open
        sourceUploadError={null}
        sourceRefreshes={[]}
        onOpenChange={vi.fn()}
        onPolicyChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("combobox", { name: "Research depth" })).not.toBeInTheDocument();
  });

  it("disconnects a source from this session without exposing selection controls", async () => {
    const user = userEvent.setup();
    const onPolicyChange = vi.fn();
    renderWith().render(
      <AuthoringSourcePopover
        sources={sources}
        policy={policy}
        open
        sourceUploadError={null}
        sourceRefreshes={[]}
        onOpenChange={vi.fn()}
        onPolicyChange={onPolicyChange}
      />,
    );

    await user.click(screen.getAllByRole("button", { name: "Remove source" })[0]);

    expect(onPolicyChange).toHaveBeenCalledWith(expect.objectContaining({ sourceVersionIds: [] }));
    expect(screen.queryByText("Current guide.pdf")).not.toBeInTheDocument();
  });

  it("shows the uploading source status without inventing progress", () => {
    renderWith().render(
      <AuthoringSourcePopover
        sources={[]}
        policy={{ ...policy, sourceVersionIds: [] }}
        open
        sourceUploadError={null}
        sourceRefreshes={[]}
        isUploadingSource
        uploadingSourceName="guide.pdf"
        onPolicyChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Uploading guide.pdf...");
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
});
