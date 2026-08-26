import { act, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { LessonVideoProgressStrip } from "../LessonVideoProgressStrip";
import {
  createLessonVideoProgressStore,
  getLessonVideoResumeTarget,
  hasStartedLessonVideo,
  parseLessonVideoProgressSegments,
} from "../LessonVideoProgressStrip.utils";

const lessonDescription = `
  <div>
    <div
      data-node-type="video"
      data-source-type="internal"
      data-src="/api/lesson/lesson-resource/11111111-1111-1111-1111-111111111111"
      data-resource-entity-id="resource-one"
      data-video-coverage-percent="0.3"
      data-video-watched-ranges="[[0,10],[20,30]]"
      data-video-duration-seconds="100"
    ></div>
    <div
      data-node-type="video"
      data-source-type="internal"
      data-src="/api/lesson/lesson-resource/22222222-2222-2222-2222-222222222222"
      data-resource-entity-id="resource-two"
      data-video-coverage-percent="0.9"
      data-video-watched-ranges="[[0,90]]"
      data-video-duration-seconds="100"
    ></div>
    <div
      data-node-type="video"
      data-source-type="external"
      data-src="https://vimeo.com/123"
    ></div>
  </div>
`;

describe("LessonVideoProgressStrip", () => {
  it("selects the latest active incomplete video before earlier started videos", () => {
    const segments = parseLessonVideoProgressSegments(lessonDescription);

    expect(getLessonVideoResumeTarget(segments, "resource-one")).toBe("resource-one");
    expect(getLessonVideoResumeTarget(segments, "resource-two")).toBe("resource-one");
    expect(segments.some(hasStartedLessonVideo)).toBe(true);
  });

  it("parses one segment per video node with watched range metadata", () => {
    expect(parseLessonVideoProgressSegments(lessonDescription)).toMatchObject([
      {
        resourceEntityId: "resource-one",
        coveragePercent: 0.3,
        watchedRanges: [
          [0, 10],
          [20, 30],
        ],
        durationSeconds: 100,
      },
      {
        resourceEntityId: "resource-two",
        coveragePercent: 0.9,
        watchedRanges: [[0, 90]],
        durationSeconds: 100,
      },
      {
        resourceEntityId: null,
        coveragePercent: 0,
        watchedRanges: [],
      },
    ]);
  });

  it("renders tracked chunks and marks 90 percent progress as completed", async () => {
    const store = createLessonVideoProgressStore();
    const { container } = renderWith().render(
      <LessonVideoProgressStrip
        lessonId="lesson-id"
        description={lessonDescription}
        enabled
        store={store}
      />,
    );

    await waitFor(() => expect(screen.getAllByRole("progressbar")).toHaveLength(3));

    const progressBars = screen.getAllByRole("progressbar");

    expect(screen.getByText("Video progress")).toBeInTheDocument();
    expect(screen.getByText("1 of 3 completed")).toBeInTheDocument();
    expect(screen.getByText("Watch all videos to complete this lesson.")).toBeInTheDocument();
    expect(progressBars[0]).toHaveAttribute("aria-valuenow", "30");
    expect(progressBars[0].querySelectorAll(".bg-primary-600")).toHaveLength(2);
    expect(progressBars[1]).toHaveAttribute("aria-valuenow", "90");
    expect(progressBars[1].querySelector(".bg-success-500")).toBeInTheDocument();
    expect(progressBars[2]).toHaveAttribute("aria-valuenow", "0");
    expect(container.querySelectorAll(".bg-success-500")).toHaveLength(1);
  });

  it("updates a segment when a video tracker reports a new snapshot", async () => {
    const store = createLessonVideoProgressStore();
    renderWith().render(
      <LessonVideoProgressStrip
        lessonId="lesson-id"
        description={lessonDescription}
        enabled
        store={store}
      />,
    );

    await waitFor(() => expect(screen.getAllByRole("progressbar")).toHaveLength(3));

    act(() => {
      store.getState().publishSnapshot({
        resourceEntityId: "resource-one",
        snapshot: {
          coveragePercent: 0.95,
          watchedRanges: [[0, 95]],
          isWatched: true,
          durationSeconds: 100,
          bucketSizeSeconds: 1,
        },
      });
    });

    await waitFor(() =>
      expect(screen.getAllByRole("progressbar")[0]).toHaveAttribute("aria-valuenow", "95"),
    );

    expect(
      screen.getAllByRole("progressbar")[0].querySelector(".bg-success-500"),
    ).toBeInTheDocument();
  });

  it("keeps a video update that arrives before the strip parses lesson content", async () => {
    const store = createLessonVideoProgressStore();

    store.getState().publishSnapshot({
      resourceEntityId: "resource-one",
      snapshot: {
        coveragePercent: 0.95,
        watchedRanges: [[0, 95]],
        isWatched: true,
        durationSeconds: 100,
        bucketSizeSeconds: 1,
      },
    });

    renderWith().render(
      <LessonVideoProgressStrip
        lessonId="lesson-id"
        description={lessonDescription}
        enabled
        store={store}
      />,
    );

    await waitFor(() =>
      expect(screen.getAllByRole("progressbar")[0]).toHaveAttribute("aria-valuenow", "95"),
    );
  });

  it("does not erase live progress when a stale empty snapshot arrives", async () => {
    const store = createLessonVideoProgressStore();

    renderWith().render(
      <LessonVideoProgressStrip
        lessonId="lesson-id"
        description={lessonDescription}
        enabled
        store={store}
      />,
    );

    await waitFor(() => expect(screen.getAllByRole("progressbar")).toHaveLength(3));

    act(() => {
      store.getState().publishSnapshot({
        resourceEntityId: "resource-one",
        snapshot: {
          coveragePercent: 0.5,
          watchedRanges: [[0, 50]],
          isWatched: false,
          durationSeconds: 100,
          bucketSizeSeconds: 1,
        },
      });
      store.getState().publishSnapshot({
        resourceEntityId: "resource-one",
        snapshot: {
          coveragePercent: 0,
          watchedRanges: [],
          isWatched: false,
          durationSeconds: null,
          bucketSizeSeconds: 1,
        },
      });
    });

    expect(screen.getAllByRole("progressbar")[0]).toHaveAttribute("aria-valuenow", "50");
    expect(
      screen.getAllByRole("progressbar")[0].querySelector(".bg-primary-600"),
    ).toBeInTheDocument();
  });
});
