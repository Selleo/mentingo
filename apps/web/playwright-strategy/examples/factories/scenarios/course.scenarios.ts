export const courseScenarios = {
  updatePricing: {
    input: {
      courseTitle: "Pricing Test Course",
      pricingMode: "paid" as const,
      chapterTitles: ["Intro", "Basics"],
    },
    expected: {
      toast: "Course updated successfully",
    },
  },
};
