import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { EmbedFrame } from "./EmbedFrame";

import type { LessonResource } from "~/modules/Admin/EditCourse/EditCourse.types";

const resource: LessonResource = {
  id: "resource-1",
  fileUrl: "https://example.com",
  allowFullscreen: true,
};

describe("EmbedFrame", () => {
  it("names the fullscreen button", () => {
    renderWith().render(<EmbedFrame resource={resource} title="Embedded page" />);

    expect(screen.getByRole("button", { name: "Fullscreen" })).toBeInTheDocument();
  });
});
