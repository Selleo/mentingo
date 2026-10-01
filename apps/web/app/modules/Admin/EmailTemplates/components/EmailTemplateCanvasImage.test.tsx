import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { EmailTemplateCanvasImage } from "./EmailTemplateCanvasImage";

const api = vi.hoisted(() => ({ getImage: vi.fn() }));
vi.mock("~/api/api-client", () => ({
  ApiClient: { api: { emailTemplateControllerGetEmailTemplateImage: api.getImage } },
}));

describe("EmailTemplateCanvasImage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolves an uploaded asset directly without constructing an email", async () => {
    api.getImage.mockResolvedValue({
      data: { data: { previewUrl: "https://storage.example/image" } },
    });
    renderWith({ withQuery: true }).render(
      <EmailTemplateCanvasImage
        block={{ type: "image", attrs: { src: "asset:image-id", alt: "Uploaded" } }}
      />,
    );
    expect(await screen.findByRole("img", { name: "Uploaded" })).toHaveAttribute(
      "src",
      "https://storage.example/image",
    );
    expect(api.getImage).toHaveBeenCalledWith("image-id");
  });

  it("leaves external HTTPS images as URLs without requesting an asset", () => {
    renderWith({ withQuery: true }).render(
      <EmailTemplateCanvasImage
        block={{ type: "image", attrs: { src: "https://cdn.example/image", alt: "External" } }}
      />,
    );
    expect(screen.getByRole("img", { name: "External" })).toHaveAttribute(
      "src",
      "https://cdn.example/image",
    );
    expect(api.getImage).not.toHaveBeenCalled();
  });
});
