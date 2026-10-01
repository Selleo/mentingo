import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { EmailTemplateBlockSettings } from "./EmailTemplateBlockSettings";

vi.mock("~/api/queries/useEmailTemplateImagePreview", () => ({
  useEmailTemplateImagePreview: () => ({ data: "https://example.com/preview.png" }),
}));

describe("EmailTemplateBlockSettings image upload", () => {
  it("hides uploaded asset references and allows replacing the image", () => {
    const onUpload = vi.fn().mockResolvedValue(undefined);
    renderWith({ withQuery: true }).render(
      <EmailTemplateBlockSettings
        block={{ type: "image", attrs: { src: "asset:image-id", alt: "" } }}
        variables={[]}
        disabled={false}
        onChange={vi.fn()}
        onUpload={onUpload}
      />,
    );
    expect(
      screen.queryByRole("textbox", { name: "Image URL or uploaded asset reference" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Uploaded" })).toHaveAttribute(
      "src",
      "https://example.com/preview.png",
    );
    const file = new File(["image"], "replacement.png", { type: "image/png" });
    const input = screen.getByLabelText("Upload image");
    fireEvent.change(input, { target: { files: [file] } });
    expect(onUpload).toHaveBeenCalledWith(file);
    expect(input).toHaveValue("");
  });

  it("keeps URL entry available before upload and disables uploading when read-only", () => {
    renderWith({ withQuery: true }).render(
      <EmailTemplateBlockSettings
        block={{ type: "image", attrs: { src: "", alt: "" } }}
        variables={[]}
        disabled
        onChange={vi.fn()}
        onUpload={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("textbox", { name: "Image URL or uploaded asset reference" }),
    ).toBeDisabled();
    expect(screen.getByLabelText("Upload image")).toBeDisabled();
  });
});
