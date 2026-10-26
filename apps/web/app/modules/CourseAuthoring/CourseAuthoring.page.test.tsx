import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigationType } from "react-router-dom";
import { describe, expect, it } from "vitest";

import CourseAuthoringPage from "./CourseAuthoring.page";

const CourseEditorDestination = () => {
  const { pathname, search } = useLocation();
  const navigationType = useNavigationType();
  return (
    <output aria-label="Course editor destination">{`${navigationType} ${pathname}${search}`}</output>
  );
};

describe("saved authoring links", () => {
  it.each([
    [
      "?sessionId=session-a&language=pl&tab=Status",
      "sessionId=session-a&language=pl&tab=Curriculum&aiGeneration=true",
    ],
    ["", "tab=Curriculum&aiGeneration=true"],
  ])("replaces the standalone page with the course drawer for %s", async (search, expected) => {
    render(
      <MemoryRouter initialEntries={[`/admin/beta-courses/course-a/authoring${search}`]}>
        <Routes>
          <Route path="/admin/beta-courses/:id/authoring" element={<CourseAuthoringPage />} />
          <Route path="/admin/beta-courses/:id" element={<CourseEditorDestination />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByLabelText("Course editor destination")).toHaveTextContent(
      `REPLACE /admin/beta-courses/course-a?${expected}`,
    );
  });
});
