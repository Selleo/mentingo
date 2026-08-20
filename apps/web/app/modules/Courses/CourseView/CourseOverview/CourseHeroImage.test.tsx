import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CourseHeroImage from "./CourseHeroImage";

describe("CourseHeroImage", () => {
  it("allows the mobile hero to grow with its content", () => {
    render(<CourseHeroImage alt="Course hero" />);

    const hero = screen.getByRole("img", { name: "Course hero" }).parentElement;

    expect(hero).toHaveClass("min-h-[22rem]");
    expect(hero).toHaveClass("md:aspect-[21/9]");
    expect(hero).not.toHaveClass("aspect-[4/3]");
    expect(hero).not.toHaveClass("min-h-[32rem]");
    expect(hero).not.toHaveClass("min-[360px]:min-h-[30rem]");
  });
});
