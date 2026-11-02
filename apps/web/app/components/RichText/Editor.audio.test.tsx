import { ENTITY_TYPES } from "@repo/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ContentEditor } from "./Editor";

vi.mock("./components/AssetLibraryDialog", () => ({ AssetLibraryDialog: () => null }));

describe("content editor audio upload", () => {
  it("leaves audio uploads to the asset library and drag-and-drop", async () => {
    render(
      <ContentEditor
        content="<p>Intro</p>"
        onChange={vi.fn()}
        allowFiles
        onUpload={vi.fn()}
        assetLibrary={{ entityType: ENTITY_TYPES.LESSON, entityId: "lesson-id", language: "en" }}
      />,
    );

    await screen.findByRole("textbox");
    expect(screen.queryByRole("button", { name: /audio/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/audio/i)).not.toBeInTheDocument();
  });
});
