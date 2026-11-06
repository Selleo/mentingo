/** Exercises real rich-text parsing rather than replacing the viewer with an HTML mock. */
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { AuthoringContentPreview } from "./AuthoringContentPreview";
import { diffContentBlocks } from "./contentDiff";
import {
  AUTHORING_OPERATION_TYPE,
  REVIEW_CHANGE_KIND,
  REVIEW_NODE_TYPE,
} from "./curriculumReview.constants";
import { applyImageInsertion } from "./imageInsertion";
import { proposedLesson } from "./proposedLesson";

import type { ReviewLessonNode } from "./curriculumReview.types";

const anchorBlockId = "00000000-0000-4000-8000-000000000001";
const siblingBlockId = "00000000-0000-4000-8000-000000000002";
const assetId = "00000000-0000-4000-8000-000000000003";
const before = `<p data-authoring-block-id="${anchorBlockId}">Before image</p><p data-authoring-block-id="${siblingBlockId}">After image</p>`;
const payload = {
  assetId,
  anchorBlockId,
  position: "after",
  altText: "Architecture diagram",
  caption: "Visible <caption>",
};

describe("structured image insertion review", () => {
  it("projects exactly one added figure and renders it between unchanged prose through the real ContentViewer", async () => {
    const node: ReviewLessonNode = {
      nodeType: REVIEW_NODE_TYPE.LESSON,
      id: "lesson",
      chapterId: "chapter",
      title: "Safety",
      previousTitle: null,
      lessonType: "content",
      kind: REVIEW_CHANGE_KIND.EDITED,
      movedFrom: null,
      proposalIds: ["proposal"],
      current: {
        id: "lesson",
        chapterId: "chapter",
        title: "Safety",
        type: "content",
        description: before,
        displayOrder: 1,
        updatedAt: "",
      },
      operations: [
        {
          operationId: "insert",
          targetId: "lesson",
          type: AUTHORING_OPERATION_TYPE.LESSON_IMAGE_INSERT,
          dependencies: [],
          payload,
        },
      ],
    };
    const after = proposedLesson(node)?.description ?? "";
    expect(diffContentBlocks(before, after).map((entry) => entry.status)).toEqual([
      "unchanged",
      "added",
      "unchanged",
    ]);
    renderWith({}).render(
      <AuthoringContentPreview
        content={after}
        trustedContent={before}
        assetPreviewUrls={{ [assetId]: "blob:approved-diagram" }}
      />,
    );
    const image = await screen.findByRole("img", { name: "Architecture diagram" });
    expect(image).toHaveAttribute("src", "blob:approved-diagram");
    expect(
      screen.getByText("Before image").compareDocumentPosition(image) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      image.compareDocumentPosition(screen.getByText("After image")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText("Visible <caption>")).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(node.current?.description).toBe(before);
  });

  it("refuses unknown anchors and duplicate image identities instead of moving an image to the end", () => {
    expect(() => applyImageInsertion(before, { ...payload, anchorBlockId: assetId })).toThrow();
    const after = applyImageInsertion(before, payload);
    expect(() => applyImageInsertion(after, payload)).toThrow();
  });
});
