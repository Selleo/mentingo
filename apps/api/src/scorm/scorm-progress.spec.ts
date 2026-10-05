import { mergeScormProgress } from "./scorm-progress";

describe("SCORM late commits", () => {
  it("preserves completed and passed status against late lower results", () => {
    expect(
      mergeScormProgress(
        { "cmi.core.lesson_status": "passed", "cmi.core.score.raw": "90" },
        { "cmi.core.lesson_status": "incomplete" },
      )["cmi.core.lesson_status"],
    ).toBe("passed");
    expect(
      mergeScormProgress(
        { "cmi.core.lesson_status": "completed" },
        { "cmi.core.lesson_status": "not attempted" },
      )["cmi.core.lesson_status"],
    ).toBe("completed");
    expect(
      mergeScormProgress(
        { "cmi.core.lesson_status": "failed" },
        { "cmi.core.lesson_status": "incomplete" },
      )["cmi.core.lesson_status"],
    ).toBe("incomplete");
  });
  it("permits a full explicit retake and not an incomplete reset", () => {
    const reset = {
      "cmi.core.lesson_status": "not attempted",
      "cmi.core.score.raw": "",
      "cmi.core.score.min": "",
      "cmi.core.score.max": "",
    };
    expect(
      mergeScormProgress({ "cmi.core.lesson_status": "passed" }, reset)["cmi.core.lesson_status"],
    ).toBe("not attempted");
    expect(
      mergeScormProgress(
        { "cmi.core.lesson_status": "passed" },
        { ...reset, "cmi.core.score.raw": "1" },
      )["cmi.core.lesson_status"],
    ).toBe("passed");
  });
});
