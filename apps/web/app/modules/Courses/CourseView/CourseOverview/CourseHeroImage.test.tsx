import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CourseHeroImage from "./CourseHeroImage";

describe("CourseHeroImage", () => {
  it("keeps the hero landscape at mobile and desktop breakpoints", () => {
    render(<CourseHeroImage alt="Course hero" />);

    const hero = screen.getByRole("img", { name: "Course hero" }).parentElement;

    expect(hero).toHaveClass("aspect-video");
    expect(hero).toHaveClass("min-h-[22rem]");
    expect(hero).toHaveClass("md:aspect-[21/9]");
  });

  it("keeps a placeholder visible behind the course image while it loads", () => {
    render(<CourseHeroImage alt="Course hero" imagePosition={25} imageUrl="/course-image.jpg" />);

    const hero = screen.getByRole("img", { name: "Course hero" });
    const image = hero.querySelector("img");

    expect(image).not.toBeNull();
    expect(image).toHaveAttribute("src", "/course-image.jpg");
    expect(image).toHaveStyle({ objectPosition: "center 25%" });
    expect(hero).toHaveStyle({
      backgroundImage: expect.stringContaining("radial-gradient"),
    });
  });
});
