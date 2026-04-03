import { courseExpected } from "../data/expected/course.expected";

import { pageFixture } from "./page.fixture";

export const expectationsFixture = pageFixture.extend<{
  expected: typeof courseExpected;
}>({
  expected: async (args, use) => {
    void args;
    await use(courseExpected);
  },
});
