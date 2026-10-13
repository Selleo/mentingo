import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { CourseGenerationInteraction } from "./CourseGenerationInteraction";

describe("CourseGenerationInteraction", () => {
  it("starts with the composer and hides empty review and execution panels", () => {
    renderWith().render(
      <CourseGenerationInteraction
        hasExistingContent={false}
        hasWork={false}
        activity={null}
        review={<div>Review panel</div>}
        activityAndQuestions={<div>Execution panel</div>}
        composer={<textarea aria-label="Generation request" />}
      />,
    );
    expect(screen.getByRole("textbox", { name: "Generation request" })).toBeVisible();
    expect(screen.queryByText("Review panel")).not.toBeInTheDocument();
    expect(screen.queryByText("Execution panel")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("keeps author questions and review accessible alongside follow-up input", () => {
    renderWith().render(
      <CourseGenerationInteraction
        hasExistingContent
        hasWork
        activity="waiting"
        history={<p>Add a worked example.</p>}
        review={<button type="button">Review lesson changes</button>}
        activityAndQuestions={<button type="button">Retry diagram generation</button>}
        composer={<textarea aria-label="Follow-up request" />}
      />,
    );
    expect(screen.getByText("Add a worked example.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Review lesson changes" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Retry diagram generation" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Follow-up request" })).toBeVisible();
    expect(screen.getByRole("status")).toBeVisible();
  });
});
