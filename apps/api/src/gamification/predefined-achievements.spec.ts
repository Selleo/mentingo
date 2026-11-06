import { ACHIEVEMENT_MAX_LEVELS, ACHIEVEMENT_REQUIREMENT_TYPES } from "@repo/shared";

import { PREDEFINED_ACHIEVEMENTS } from "./predefined-achievements";

describe("PREDEFINED_ACHIEVEMENTS", () => {
  it("uses unique keys, since seeding skips a duplicate key silently", () => {
    const keys = PREDEFINED_ACHIEVEMENTS.map(({ key }) => key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each(PREDEFINED_ACHIEVEMENTS.map((definition) => [definition.key, definition]))(
    "%s has contiguous levels with increasing thresholds and matching locales",
    (_key, definition) => {
      const { levels, requirementType, title, description } = definition;

      expect(levels.length).toBeLessThanOrEqual(ACHIEVEMENT_MAX_LEVELS);
      expect(levels.map(({ level }) => level)).toEqual(levels.map((_level, index) => index + 1));
      levels.slice(1).forEach(({ threshold }, index) => {
        expect(threshold).toBeGreaterThan(levels[index].threshold);
      });
      levels.forEach(({ threshold, xpReward }) => {
        expect(threshold).toBeGreaterThanOrEqual(1);
        expect(xpReward).toBeGreaterThanOrEqual(0);
      });
      expect(new Set(Object.keys(description))).toEqual(new Set(Object.keys(title)));

      if (requirementType === ACHIEVEMENT_REQUIREMENT_TYPES.FIRST_TIME) {
        expect(levels).toEqual([expect.objectContaining({ level: 1, threshold: 1 })]);
      }
    },
  );
});
