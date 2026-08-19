import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CourseHeroImage from "./CourseHeroImage";

describe("CourseHeroImage", () => {
  it("keeps the mobile hero at the course overview aspect ratio", () => {
    render(<CourseHeroImage alt="Course hero" />);

    const hero = screen.getByRole("img", { name: "Course hero" }).parentElement;

    expect(hero).toHaveClass("aspect-[4/3]");
    expect(hero).not.toHaveClass("min-h-[32rem]");
    expect(hero).not.toHaveClass("min-[360px]:min-h-[30rem]");
  });
});
