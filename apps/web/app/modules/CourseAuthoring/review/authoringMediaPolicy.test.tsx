import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ImageUploadInput from "~/components/FileUploadInput/ImageUploadInput";
import { ContentEditor } from "~/components/RichText/Editor";
import { ContentViewer } from "~/components/RichText/Viever";
import { renderWith } from "~/utils/testUtils";

import { AuthoringContentPreview } from "./AuthoringContentPreview";
import {
  AuthoringMediaPolicyProvider,
  buildAuthoringMediaPolicy,
  restrictAuthoringMedia,
} from "./authoringMediaPolicy";

const approved = "https://media.example.test/native.png?version=1";
const leaked = "https://media.example.test/native.png?private=PRIVATE_SENTINEL";
const assetId = "11111111-1111-4111-8111-111111111111";

const expectNoPrivateRequest = (container: HTMLElement) => {
  for (const element of container.querySelectorAll("*")) {
    for (const attribute of element.attributes)
      expect(attribute.value).not.toContain("PRIVATE_SENTINEL");
  }
};

describe("authoring media request boundary", () => {
  it("matches complete trusted URLs rather than hosts and blocks native-node/resource substitutions", () => {
    const policy = buildAuthoringMediaPolicy([
      `<div data-node-type="image" data-src="${approved}" data-resource-id="approved-resource"></div>`,
    ]);
    const html = restrictAuthoringMedia(
      `<img src="${leaked}" alt="Unapproved"><iframe src="${leaked}"></iframe><div data-node-type="image" data-src="${approved}" data-resource-id="different-resource"></div><img src="${approved}" alt="Approved"><p style="background:url(${leaked})">Text</p>`,
      policy,
      "Unavailable",
    );
    expect(html).not.toContain("PRIVATE_SENTINEL");
    expect(html).not.toContain("iframe");
    expect(html).not.toContain("different-resource");
    expect(html).toContain(approved);
    expect(html).toContain("Approved");
    expect(html).not.toContain("style=");
  });

  it("never installs model-generated media URLs in review DOM", async () => {
    const { container } = renderWith().render(
      <AuthoringContentPreview
        content={`<p>Body</p><img src="${leaked}" alt="Unapproved image"><iframe src="${leaked}"></iframe><div data-node-type="video" data-src="${leaked}"></div>`}
        trustedContent={`<img src="${approved}">`}
      />,
    );
    expectNoPrivateRequest(container);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.querySelector("iframe,video")).toBeNull();
    expect(screen.getByText(/Unapproved image/)).toBeInTheDocument();
  });

  it("protects native readonly editors and ordinary viewers before Tiptap mounts media", async () => {
    const content = `<p>Body</p><div data-node-type="image" data-src="${leaked}" data-alt="Unapproved image"></div>`;
    const { container } = renderWith().render(
      <AuthoringMediaPolicyProvider trustedHtml={[`<img src="${approved}">`]}>
        <ContentEditor editable={false} content={content} onChange={vi.fn()} />
        <ContentViewer content={content} />
      </AuthoringMediaPolicyProvider>,
    );
    await waitFor(() => expect(screen.getAllByText(/Unapproved image/)).toHaveLength(2));
    expectNoPrivateRequest(container);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("blocks direct native image inputs without changing native inputs outside authoring", () => {
    const { container, rerender } = renderWith().render(
      <AuthoringMediaPolicyProvider trustedHtml={[]} trustedUrls={[approved]}>
        <ImageUploadInput
          field={{ value: leaked }}
          imageUrl={leaked}
          handleImageUpload={vi.fn()}
          isUploading={false}
        />
      </AuthoringMediaPolicyProvider>,
    );
    expectNoPrivateRequest(container);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    rerender(
      <ImageUploadInput
        field={{ value: leaked }}
        imageUrl={leaked}
        handleImageUpload={vi.fn()}
        isUploading={false}
      />,
    );
    expect(screen.getByRole("img")).toHaveAttribute("src", leaked);
  });

  it("keeps a ready typed asset preview and rejects a changed URL even when its asset ID matches", async () => {
    const { container } = renderWith().render(
      <AuthoringContentPreview
        content={`<img data-authoring-asset-id="${assetId}" src="${leaked}" alt="Ready diagram">`}
        assetPreviewUrls={{ [assetId]: "blob:approved-preview" }}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole("img", { name: "Ready diagram" })).toHaveAttribute(
        "src",
        "blob:approved-preview",
      ),
    );
    expectNoPrivateRequest(container);
  });
});
