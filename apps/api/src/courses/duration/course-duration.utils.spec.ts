import { LESSON_TYPES } from "src/lesson/lesson.type";

import { calculateLessonDurationSeconds } from "./course-duration.utils";

const audioId = "11111111-1111-4111-8111-111111111111";

const calculateAudioLesson = (
  descriptionHtml: string,
  durationSeconds: number | undefined = 65.2,
) =>
  calculateLessonDurationSeconds({
    descriptionHtml,
    lessonType: LESSON_TYPES.CONTENT,
    quizQuestionCount: 0,
    resourcesByReference: new Map([
      [
        audioId,
        {
          id: audioId,
          resourceEntityId: null,
          contentType: "audio/mpeg",
          metadata: { durationSeconds },
        },
      ],
    ]),
  });

const audioNode = `<div data-node-type="audio" data-src="/api/lesson/lesson-resource/${audioId}"></div>`;

describe("content lesson audio duration", () => {
  it.each([0, -1, NaN, Infinity])("uses the media fallback for invalid duration %s", (duration) => {
    expect(calculateAudioLesson(audioNode, duration)).toBe(180);
  });

  it("does not trust an HTML duration or an unresolved audio source", () => {
    expect(
      calculateAudioLesson(
        '<div data-node-type="audio" data-src="https://example.com/audio.mp3" data-duration-seconds="9999"></div>',
      ),
    ).toBe(180);
  });

  it("does not count audio attached without an embedded audio node", () => {
    expect(calculateAudioLesson("<p>Hello world</p>")).toBe(1);
  });

  it("does not treat an audio resource embedded as a download as playback", () => {
    expect(
      calculateAudioLesson(
        `<div data-node-type="downloadable-file" data-src="/api/lesson/lesson-resource/${audioId}"></div>`,
      ),
    ).toBe(30);
  });
  it("adds canonical audio duration for each embedded occurrence to reading time", () => {
    expect(calculateAudioLesson(`<p>Hello world</p>${audioNode}${audioNode}`)).toBe(133);
  });
});
