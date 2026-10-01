import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("~/components/UserProfile/UserProfile", () => ({ UserProfile: () => null }));

import { renderWith } from "~/utils/testUtils";

import CourseCardPreview from "./CourseCardPreview";

describe("CourseCardPreview", () => {
  it("shows formatted course text without rendering active HTML", () => {
    const { container } = renderWith().render(
      <CourseCardPreview
        description={
          '<p>Learn <strong>security</strong></p><iframe src="https://attacker.example/payload"></iframe><img src=x onerror="alert(1)"><a href="javascript:alert(1)">bad link</a>'
        }
      />,
    );

    expect(screen.getByText("security")).toHaveProperty("tagName", "STRONG");
    expect(container.querySelector("iframe, img[onerror], a[href^='javascript:']")).toBeNull();
  });
});
