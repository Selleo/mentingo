import { ENTITY_TYPES } from "@repo/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import i18n from "i18n";

import { ContentEditor } from "./Editor";

vi.mock("./components/AssetLibraryDialog", () => ({ AssetLibraryDialog: () => null }));

const config = { entityType: ENTITY_TYPES.LESSON, entityId: "lesson-id", language: "en" as const };

describe("content editor audio upload", () => {
  it("offers a named lesson-only audio picker, rejects non-audio, and uploads the selected audio", async () => {
    const onUpload = vi.fn().mockResolvedValue(undefined);
    render(
      <ContentEditor
        content="<p>Intro</p>"
        onChange={vi.fn()}
        allowFiles
        onUpload={onUpload}
        assetLibrary={config}
      />,
    );
    const button = await screen.findByTestId("rich-text-editor-audio-upload-button");
    expect(button).toHaveAccessibleName(i18n.t("richText.audio.upload"));
    const input = screen.getByTestId("rich-text-editor-audio-upload-input") as HTMLInputElement;
    expect(input.accept).toContain("audio/mpeg");
    expect(input.accept).not.toContain("audio/*");
    fireEvent.change(input, {
      target: { files: [new File(["pdf"], "wrong.pdf", { type: "application/pdf" })] },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      i18n.t("richText.audio.invalidType"),
    );
    expect(onUpload).not.toHaveBeenCalled();
    const audio = new File(["audio"], "interview.mp3", { type: "audio/mpeg" });
    fireEvent.change(input, { target: { files: [audio] } });
    await waitFor(() => expect(onUpload).toHaveBeenCalledWith(audio, expect.anything()));
    expect(input.value).toBe("");
  });

  it("does not advertise audio uploads for articles", async () => {
    render(
      <ContentEditor
        content="<p>Intro</p>"
        onChange={vi.fn()}
        allowFiles
        onUpload={vi.fn()}
        assetLibrary={{ ...config, entityType: ENTITY_TYPES.ARTICLES }}
      />,
    );
    await screen.findByRole("textbox");
    expect(screen.queryByTestId("rich-text-editor-audio-upload-button")).not.toBeInTheDocument();
  });
});
