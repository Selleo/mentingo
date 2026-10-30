import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { USER_ROLE } from "~/config/userRoles";

import { RICH_TEXT_HANDLES } from "../../data/common/handles";
import { CONTENT_LESSON_FORM_HANDLES } from "../../data/curriculum/handles";
import { LEARNING_HANDLES } from "../../data/learning/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { selfEnrollCourseFlow } from "../../flows/courses/self-enroll-course.flow";
import { fillContentLessonFormFlow } from "../../flows/curriculum/fill-content-lesson-form.flow";
import { openCurriculumPageFlow } from "../../flows/curriculum/open-curriculum-page.flow";
import { openExistingLessonFlow } from "../../flows/curriculum/open-existing-lesson.flow";
import { openNewLessonFormFlow } from "../../flows/curriculum/open-new-lesson-form.flow";
import { saveContentLessonFormFlow } from "../../flows/curriculum/save-content-lesson-form.flow";
import { uploadContentAudioFlow } from "../../flows/curriculum/upload-content-audio.flow";

import { createCurriculumCourse } from "./curriculum-test-helpers";

const audioPath = fileURLToPath(
  new URL("../../data/test-data/audio/lesson-tone.wav", import.meta.url),
);

test("author uploads persistent content lesson audio and enrolled learner plays and seeks it", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  let courseId = "";
  let lessonId = "";
  let storedSource = "";
  const title = `audio-lesson-${Date.now()}`;

  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const { category, course, categoryFactory, courseFactory } = await createCurriculumCourse(
      factories,
      title,
    );
    courseId = course.id;
    cleanup.add(async () => {
      await withWorkerPage(USER_ROLE.admin, async () => {
        await courseFactory.update(course.id, { status: "draft", language: "en" });
        await courseFactory.delete(course.id);
        await categoryFactory.delete(category.id);
      });
    });
    const chapter = await factories.createCurriculumFactory().createChapter({
      courseId,
      title: `${title}-chapter`,
    });

    await openCurriculumPageFlow(page, courseId);
    await openNewLessonFormFlow(page, chapter.id, "content");
    await fillContentLessonFormFlow(page, { title, description: "Listen to this lesson." });
    const editor = page.getByTestId(CONTENT_LESSON_FORM_HANDLES.ROOT);
    await expect(editor.getByTestId(RICH_TEXT_HANDLES.AUDIO_UPLOAD_BUTTON)).toBeVisible();
    await uploadContentAudioFlow(page, audioPath);
    const authorAudio = editor.locator("audio");
    await expect(authorAudio).toHaveCount(1);
    await expect(authorAudio).toHaveAttribute("controls", "");
    await expect.poll(() => authorAudio.evaluate((el: HTMLAudioElement) => el.duration)).toBe(12);
    storedSource = (await authorAudio.getAttribute("src")) ?? "";
    expect(storedSource).not.toMatch(/^(blob:|data:)/);
    expect(storedSource).not.toBe("");
    await saveContentLessonFormFlow(page);

    await expect
      .poll(async () => {
        const saved = await courseFactory.getById(courseId);
        lessonId =
          saved.chapters.flatMap((item) => item.lessons ?? []).find((item) => item.title === title)
            ?.id ?? "";
        return lessonId;
      })
      .not.toBe("");

    await page.reload();
    await openExistingLessonFlow(page, chapter.id, lessonId);
    await expect(editor.locator("audio")).toHaveCount(1);
    await expect(editor.locator("audio")).toHaveAttribute("src", storedSource);
    await expect
      .poll(() => editor.locator("audio").evaluate((el: HTMLAudioElement) => el.duration))
      .toBe(12);
    await courseFactory.update(courseId, { status: "published", language: "en" });
  });

  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    await selfEnrollCourseFlow(page, courseId);
    await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${lessonId}$`));
    await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(title);
    const audio = page.locator("audio");
    await expect(audio).toHaveCount(1);
    await expect(audio).toHaveAttribute("controls", "");
    await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.duration)).toBe(12);
    // Activate native playback after a trusted click; exercise the browser media decoder, not a mock.
    await audio.click();
    await audio.evaluate((el: HTMLAudioElement) => el.play());
    await expect
      .poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentTime))
      .toBeGreaterThan(0.25);
    await audio.evaluate((el: HTMLAudioElement) => {
      el.pause();
      el.currentTime = 7;
    });
    await expect
      .poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentTime))
      .toBeCloseTo(7, 1);
    await audio.evaluate((el: HTMLAudioElement) => el.play());
    await expect
      .poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentTime))
      .toBeGreaterThan(7.25);
    await audio.evaluate((el: HTMLAudioElement) => el.pause());

    const source = await audio.evaluate((el: HTMLAudioElement) => el.currentSrc);
    const full = await page.request.get(source);
    expect(full.status()).toBe(200);
    expect(full.headers()["content-type"]).toMatch(/^audio\//);
    expect(full.headers()["accept-ranges"]).toBe("bytes");
    expect(full.headers()["content-disposition"] ?? "").not.toMatch(/attachment/i);
    const fixture = readFileSync(audioPath);
    expect(full.headers()["content-length"]).toBe(String(fixture.length));
    expect(await full.body()).toEqual(fixture);
    const range = await page.request.get(source, { headers: { Range: "bytes=1024-2047" } });
    expect(range.status()).toBe(206);
    expect(range.headers()["content-type"]).toMatch(/^audio\//);
    expect(range.headers()["content-range"]).toBe(`bytes 1024-2047/${fixture.length}`);
    expect(range.headers()["content-length"]).toBe("1024");
    expect(await range.body()).toEqual(fixture.subarray(1024, 2048));
  });
});
