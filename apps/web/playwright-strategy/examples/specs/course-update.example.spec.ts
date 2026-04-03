import { courseScenario } from "../data/scenarios/course.scenario";
import { test, expect } from "../fixtures/test.fixture";
import { courseFlow } from "../flows/course.flow";

test("updates course pricing @core @courses", async ({ page, createCourseWorld, expected }) => {
  const world = await createCourseWorld({
    courseTitle: courseScenario.updatePricing.input.courseTitle,
    chapterTitles: courseScenario.updatePricing.input.chapterTitles,
  });

  await courseFlow.openEditor(page, world.course.id);
  await courseFlow.updatePricing(page, courseScenario.updatePricing.input.pricingMode);

  await expect(page.getByText(expected.pricingUpdatedToast)).toBeVisible(); // intentional copy assertion
});
