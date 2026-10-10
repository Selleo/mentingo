import { act, fireEvent, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "~/components/ui/drawer";
import { renderWith } from "~/utils/testUtils";

import { AuthoringBriefPanel } from "./AuthoringBriefPanel";

import type { CourseContext, SourceView } from "../courseAuthoring.types";

const course: CourseContext = {
  courseId: "course-1",
  language: "en",
  title: "Safety",
  description: "",
  baselineHash: "course-hash",
  fieldHashes: {},
  chapters: [],
};

const readySource = (id: string, name: string): SourceView => ({
  id,
  name,
  status: "ready",
  selected: true,
  mediaType: "application/pdf",
  readableSections: 1,
  totalSections: 1,
  warning: null,
  sections: [],
});

describe("AuthoringBriefPanel", () => {
  it("keeps the effort popover open while dragging its slider inside the drawer", async () => {
    const user = userEvent.setup();
    renderWith().render(
      <Drawer open modal={false}>
        <DrawerContent forceMount renderOverlay={false}>
          <DrawerTitle>Course authoring</DrawerTitle>
          <DrawerDescription>Course generation composer</DrawerDescription>
          <AuthoringBriefPanel
            course={course}
            initialSourcePolicy={null}
            reasoningControlAvailable
            onSubmit={vi.fn().mockResolvedValue(undefined)}
            onSelectSources={vi.fn()}
          />
        </DrawerContent>
      </Drawer>,
    );

    await user.click(screen.getByRole("button", { name: "Thinking effort: Balanced" }));
    const slider = screen.getByRole("slider", { name: "Thinking effort" });
    fireEvent.pointerDown(slider, { pointerId: 1, pointerType: "mouse" });
    fireEvent.change(slider, { target: { value: "2" } });
    fireEvent.pointerMove(slider, { pointerId: 1, pointerType: "mouse" });

    expect(screen.getByRole("slider", { name: "Thinking effort" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Thinking effort: Thorough" })).toBeVisible();
  });

  it("sends the selected first-party reasoning effort without changing research depth", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderWith().render(
      <AuthoringBriefPanel
        course={course}
        initialSourcePolicy={null}
        reasoningControlAvailable
        onSubmit={onSubmit}
        onSelectSources={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Thinking effort: Balanced" }));
    fireEvent.change(screen.getByRole("slider", { name: "Thinking effort" }), {
      target: { value: "2" },
    });
    await user.type(screen.getByTestId("course-authoring-brief-input"), "Create one lesson");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        reasoningEffort: "high",
        sourcePolicy: expect.objectContaining({ researchDepth: "standard" }),
      }),
    );
  });

  it("opens source controls instead of submitting without source authority", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    renderWith().render(
      <AuthoringBriefPanel
        course={course}
        initialSourcePolicy={{
          sourceVersionIds: [],
          webEnabled: false,
          generalKnowledgeEnabled: false,
          researchDepth: "standard",
          requiredSectionIds: [],
          excludedSectionIds: [],
        }}
        onSubmit={onSubmit}
        onSelectSources={vi.fn()}
      />,
    );

    await user.type(screen.getByTestId("course-authoring-brief-input"), "Create a safety course");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByText("Add sources, choose a scope, or adjust how AI works.")).toBeNull();
    expect(screen.getByText("Attach files")).toBeVisible();
    expect(
      screen.getByRole("alert", {
        name: "Choose a source or enable a source permission before sending.",
      }),
    ).toBeVisible();
    expect(
      screen.getByText("Choose a source or enable a source permission before sending."),
    ).toBeVisible();
  });

  it("uses general knowledge for a new session and shows it in the source control", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    renderWith().render(
      <AuthoringBriefPanel
        course={course}
        initialSourcePolicy={null}
        sources={[]}
        onSubmit={onSubmit}
        onSelectSources={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Open course tools/ })).toBeVisible();
    await user.type(screen.getByTestId("course-authoring-brief-input"), "Create a safety course");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0]?.[0].sourcePolicy.generalKnowledgeEnabled).toBe(true);
  });

  it("keeps a newly enabled web source for the next request across a stale session refresh", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const stalePolicy = {
      sourceVersionIds: [],
      webEnabled: false,
      generalKnowledgeEnabled: true,
      researchDepth: "standard" as const,
      requiredSectionIds: [],
      excludedSectionIds: [],
    };
    const rendered = renderWith().render(
      <AuthoringBriefPanel
        course={course}
        sessionId="session-1"
        initialSourcePolicy={stalePolicy}
        onSubmit={onSubmit}
        onSelectSources={vi.fn()}
      />,
    );

    const input = screen.getByTestId("course-authoring-brief-input");
    await user.type(input, "First request");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(onSubmit.mock.calls[0]?.[0].sourcePolicy.webEnabled).toBe(false);

    await user.type(input, "And is it on now?");
    await user.click(screen.getByRole("button", { name: /Open course tools/ }));
    await user.click(screen.getByRole("button", { name: "Web search" }));
    expect(screen.getByRole("button", { name: "Web search" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.keyboard("{Escape}");

    rendered.rerender(
      <AuthoringBriefPanel
        course={course}
        sessionId="session-1"
        initialSourcePolicy={stalePolicy}
        onSubmit={onSubmit}
        onSelectSources={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Open course tools/ }));
    expect(screen.getByRole("button", { name: "Web search" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(onSubmit.mock.calls[1]?.[0]).toMatchObject({
      instruction: "And is it on now?",
      sourcePolicy: { webEnabled: true, generalKnowledgeEnabled: true },
    });
  });

  it.each(["standard", "deep"] as const)(
    "accepts a newer approved policy after strict-source overrides: %s",
    async (researchDepth) => {
      const user = userEvent.setup();
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const onSelectSources = vi.fn();
      const initialPolicy = {
        sourceVersionIds: ["source-1"],
        webEnabled: true,
        generalKnowledgeEnabled: false,
        researchDepth: "standard" as const,
        requiredSectionIds: [],
        excludedSectionIds: [],
      };
      const props = {
        course,
        sessionId: "session-1",
        onSubmit,
        onSelectSources,
        sources: [readySource("source-1", "Guide.pdf")],
        initialSourcePolicy: initialPolicy,
      };
      const rendered = renderWith().render(
        <AuthoringBriefPanel {...props} sourcePolicySequence={1} />,
      );
      await user.click(screen.getByRole("button", { name: /Open course tools/ }));
      await user.click(screen.getByRole("button", { name: /Only my sources/ }));
      expect(onSelectSources).toHaveBeenLastCalledWith(
        expect.objectContaining({ webEnabled: false }),
      );
      await user.keyboard("{Escape}");
      // A new durable grant can equal the pre-override policy; its sequence still matters.
      rendered.rerender(
        <AuthoringBriefPanel
          {...props}
          sourcePolicySequence={2}
          initialSourcePolicy={{ ...initialPolicy, researchDepth }}
        />,
      );
      await user.type(
        screen.getByTestId("course-authoring-brief-input"),
        "Research the next lesson",
      );
      await user.click(screen.getByRole("button", { name: "Send" }));
      expect(onSubmit).toHaveBeenCalledOnce();
      expect(onSubmit.mock.calls[0]?.[0].sourcePolicy).toMatchObject({
        webEnabled: true,
        researchDepth,
      });
    },
  );

  it("preserves the newest local edit through earlier acknowledgments and accepts later revocation", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onSelectSources = vi.fn();
    const initialPolicy = {
      sourceVersionIds: [],
      webEnabled: false,
      generalKnowledgeEnabled: true,
      researchDepth: "standard" as const,
      requiredSectionIds: [],
      excludedSectionIds: [],
    };
    const props = { course, sessionId: "session-1", onSubmit, onSelectSources };
    const rendered = renderWith().render(
      <AuthoringBriefPanel
        {...props}
        initialSourcePolicy={initialPolicy}
        sourcePolicySequence={1}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Open course tools/ }));
    await user.click(screen.getByRole("button", { name: "Web search" }));
    const webPolicy = onSelectSources.mock.calls.at(-1)?.[0];
    await user.click(screen.getByRole("button", { name: "Deep research" }));
    const deepPolicy = onSelectSources.mock.calls.at(-1)?.[0];
    rendered.rerender(
      <AuthoringBriefPanel {...props} initialSourcePolicy={webPolicy} sourcePolicySequence={2} />,
    );
    expect(screen.getByRole("button", { name: "Deep research" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    rendered.rerender(
      <AuthoringBriefPanel {...props} initialSourcePolicy={deepPolicy} sourcePolicySequence={3} />,
    );
    rendered.rerender(
      <AuthoringBriefPanel
        {...props}
        initialSourcePolicy={initialPolicy}
        sourcePolicySequence={4}
      />,
    );
    expect(screen.getByRole("button", { name: "Web search" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    // An older incoming snapshot cannot restore permission after the revocation.
    rendered.rerender(
      <AuthoringBriefPanel {...props} initialSourcePolicy={webPolicy} sourcePolicySequence={2} />,
    );
    await user.keyboard("{Escape}");
    await user.type(screen.getByTestId("course-authoring-brief-input"), "Next request");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(onSubmit.mock.calls[0]?.[0].sourcePolicy).toMatchObject({
      webEnabled: false,
      researchDepth: "standard",
    });
  });

  it("uses check rows for independent web, deep-thinking, and strict-source controls", async () => {
    const user = userEvent.setup();
    const onSelectSources = vi.fn();
    renderWith().render(
      <AuthoringBriefPanel
        course={course}
        initialSourcePolicy={{
          sourceVersionIds: [],
          webEnabled: false,
          generalKnowledgeEnabled: true,
          researchDepth: "standard",
          requiredSectionIds: [],
          excludedSectionIds: [],
        }}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onSelectSources={onSelectSources}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Open course tools" }));
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Only my sources/ })).toBeVisible();
    expect(document.querySelector("[data-course-authoring-view]")).toHaveClass("overflow-hidden");
    expect(document.querySelector("[data-course-authoring-view]")).not.toHaveStyle({
      maxHeight: "min(32rem, var(--radix-popover-content-available-height, 100dvh))",
    });
    expect(screen.getByRole("button", { name: "Deep research" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    await user.click(screen.getByRole("button", { name: "Deep research" }));
    expect(onSelectSources).toHaveBeenLastCalledWith(
      expect.objectContaining({ researchDepth: "deep" }),
    );
    await user.click(screen.getByRole("button", { name: /Only my sources/ }));
    expect(onSelectSources).toHaveBeenLastCalledWith(
      expect.objectContaining({
        webEnabled: false,
        generalKnowledgeEnabled: false,
      }),
    );
    await user.click(screen.getByRole("button", { name: "Web search" }));
    expect(onSelectSources).toHaveBeenLastCalledWith(
      expect.objectContaining({
        webEnabled: true,
        generalKnowledgeEnabled: true,
      }),
    );
    for (const label of ["Web search", "Deep research"]) {
      const row = screen.getByRole("button", { name: label });
      const icons = row.querySelectorAll("svg");
      const check = icons.item(icons.length - 1);
      expect(check).toHaveClass("size-4");
      expect(check.parentElement).not.toHaveClass("rounded");
      expect(check.parentElement).not.toHaveClass("border");
    }
  });

  it("keeps the scope list bounded and uses an icon-only Back control", async () => {
    const user = userEvent.setup();
    const scopedCourse: CourseContext = {
      ...course,
      chapters: [
        {
          id: "chapter-1",
          title: "Chapter one",
          displayOrder: 0,
          baselineHash: "chapter-hash",
          lessons: Array.from({ length: 36 }, (_, index) => ({
            id: `lesson-${index + 1}`,
            title: `Lesson ${index + 1}`,
            lessonType: "content",
            displayOrder: index,
            baselineHash: `lesson-hash-${index + 1}`,
            blocks: [],
          })),
        },
      ],
    };
    renderWith().render(
      <Drawer open modal={false} shouldScaleBackground={false}>
        <DrawerContent forceMount renderOverlay={false}>
          <DrawerTitle>Course authoring</DrawerTitle>
          <DrawerDescription>Course generation composer</DrawerDescription>
          <AuthoringBriefPanel
            course={scopedCourse}
            initialSourcePolicy={null}
            onSubmit={vi.fn().mockResolvedValue(undefined)}
            onSelectSources={vi.fn()}
          />
        </DrawerContent>
      </Drawer>,
    );

    await user.click(screen.getByRole("button", { name: "Open course tools" }));
    await user.click(screen.getByRole("button", { name: /Scope/ }));

    const scopeList = await screen.findByTestId("course-authoring-scope-list");
    expect(scopeList).toHaveClass("space-y-1");
    expect(scopeList.querySelectorAll("button[aria-pressed]")).toHaveLength(1);
    await user.click(scopeList.querySelector('button[aria-expanded="false"]') as HTMLButtonElement);
    expect(scopeList.querySelectorAll("button[aria-pressed]")).toHaveLength(37);
    const popup = scopeList.closest("[data-course-authoring-popup]");
    expect(popup).toHaveAttribute("data-vaul-no-drag");
    expect(popup?.closest("[data-vaul-drawer]")).toBeTruthy();
    const scopeScroller = scopeList.parentElement;
    expect(scopeScroller).toHaveClass("overflow-y-auto", "overscroll-contain");
    expect(scopeScroller).toHaveClass("max-h-[min(32rem,80dvh)]");

    const back = await screen.findByRole("button", { name: "Back" });
    expect(back).toHaveTextContent("");
    expect(back.querySelector("svg")).toHaveClass("lucide-arrow-left");
    expect(
      screen.getAllByRole("button", { name: /Chapter one/ })[0]?.querySelector("svg"),
    ).toHaveClass("lucide-check");
  });

  it("shows an upload chip immediately and gates send until the source is ready", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    let resolveUpload!: (sourceVersionId: string) => void;
    const onUploadSource = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveUpload = resolve;
        }),
    );

    const rendered = renderWith().render(
      <AuthoringBriefPanel
        course={course}
        initialSourcePolicy={null}
        sources={[]}
        onSubmit={onSubmit}
        onSelectSources={vi.fn()}
        onUploadSource={onUploadSource}
      />,
    );

    await user.type(screen.getByTestId("course-authoring-brief-input"), "Use this guide");
    await user.click(screen.getByRole("button", { name: "Open course tools" }));
    const input = document.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    fireEvent.change(input as HTMLInputElement, {
      target: { files: [new File(["guide"], "guide.pdf", { type: "application/pdf" })] },
    });

    expect(onUploadSource).toHaveBeenCalledOnce();
    const pendingAttachment = screen.getByTestId("course-authoring-composer-attachments");
    expect(pendingAttachment).toHaveTextContent("guide.pdf");
    expect(pendingAttachment).not.toHaveTextContent("Uploading");
    expect(pendingAttachment.textContent?.match(/guide\.pdf/g)).toHaveLength(1);
    expect(pendingAttachment.querySelector(".rounded-lg.border")).not.toBeNull();
    expect(pendingAttachment.querySelector(".animate-spin")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Stop generation" })).not.toBeInTheDocument();
    expect(screen.queryByText(/preparing your response/i)).not.toBeInTheDocument();

    await act(async () => {
      resolveUpload("source-1");
    });
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    expect(pendingAttachment).toHaveTextContent("Processing");
    expect(screen.getByRole("button", { name: "Send" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument();
    expect(screen.queryByText(/preparing your response/i)).not.toBeInTheDocument();
    expect(pendingAttachment).not.toHaveTextContent("Uploading");
    expect(pendingAttachment.querySelector(".animate-spin")).toBeNull();
    await user.type(screen.getByTestId("course-authoring-brief-input"), " more detail");
    await user.keyboard("{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();

    const source: SourceView = {
      id: "source-1",
      name: "guide.pdf",
      status: "processing",
      selected: true,
      mediaType: "application/pdf",
      readableSections: 0,
      totalSections: null,
      warning: null,
      sections: [],
    };
    const withStatus = (status: SourceView["status"], sessionId?: string) =>
      rendered.rerender(
        <AuthoringBriefPanel
          course={course}
          sessionId={sessionId}
          initialSourcePolicy={null}
          sources={[{ ...source, status }]}
          onSubmit={onSubmit}
          onSelectSources={vi.fn()}
          onUploadSource={onUploadSource}
        />,
      );

    withStatus("queued", "session-created-by-upload");
    expect(screen.getByTestId("course-authoring-composer-attachments")).toHaveTextContent(
      "guide.pdf",
    );
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    withStatus("processing", "session-created-by-upload");
    expect(pendingAttachment).toHaveTextContent("Processing");
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    withStatus("ready", "session-created-by-upload");
    expect(pendingAttachment).toHaveTextContent("Ready");
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
    withStatus("partial", "session-created-by-upload");
    expect(pendingAttachment).toHaveTextContent("Processing incomplete");
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    withStatus("failed", "session-created-by-upload");
    expect(pendingAttachment).toHaveTextContent("Failed");
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Remove attachment guide.pdf" }));
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
  });

  it("keeps a removed pending upload out of the next request after it finishes", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onSelectSources = vi.fn();
    let resolveUpload!: (sourceVersionId: string) => void;
    const onUploadSource = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveUpload = resolve;
        }),
    );
    const rendered = renderWith().render(
      <AuthoringBriefPanel
        course={course}
        initialSourcePolicy={null}
        onSubmit={onSubmit}
        onSelectSources={onSelectSources}
        onUploadSource={onUploadSource}
      />,
    );

    await user.type(screen.getByTestId("course-authoring-brief-input"), "Use the guide");
    await user.click(screen.getByRole("button", { name: "Open course tools" }));
    const fileInput = document.querySelector('input[type="file"]');
    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [new File(["guide"], "guide.pdf", { type: "application/pdf" })] },
    });

    await user.click(screen.getByRole("button", { name: "Remove attachment guide.pdf" }));
    expect(screen.queryByTestId("course-authoring-composer-attachments")).toBeNull();

    rendered.rerender(
      <AuthoringBriefPanel
        course={course}
        initialSourcePolicy={null}
        isUploadingSource
        onSubmit={onSubmit}
        onSelectSources={onSelectSources}
        onUploadSource={onUploadSource}
      />,
    );
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        attachedSourceVersionIds: [],
        sourcePolicy: expect.objectContaining({ sourceVersionIds: [] }),
      }),
    );

    await act(async () => {
      resolveUpload("source-removed-while-uploading");
    });
    rendered.rerender(
      <AuthoringBriefPanel
        course={course}
        initialSourcePolicy={null}
        sources={[readySource("source-removed-while-uploading", "guide.pdf")]}
        onSubmit={onSubmit}
        onSelectSources={onSelectSources}
        onUploadSource={onUploadSource}
      />,
    );

    expect(screen.queryByTestId("course-authoring-composer-attachments")).toBeNull();
    expect(onSelectSources).not.toHaveBeenCalled();
  });

  it("merges concurrent upload selections and keeps removal decisions current", async () => {
    const user = userEvent.setup();
    const onSelectSources = vi.fn();
    const resolveUpload = new Map<string, (sourceVersionId: string) => void>();
    const onUploadSource = vi.fn(
      (file: File) =>
        new Promise<string>((resolve) => {
          resolveUpload.set(file.name, resolve);
        }),
    );
    const rendered = renderWith().render(
      <AuthoringBriefPanel
        course={course}
        initialSourcePolicy={null}
        sources={[]}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onSelectSources={onSelectSources}
        onUploadSource={onUploadSource}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Open course tools" }));
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const upload = (name: string) =>
      fireEvent.change(fileInput, {
        target: { files: [new File([name], name, { type: "application/pdf" })] },
      });
    upload("guide-one.pdf");
    upload("guide-two.pdf");
    upload("guide-three.pdf");

    await act(async () => {
      resolveUpload.get("guide-one.pdf")?.("source-one");
      resolveUpload.get("guide-two.pdf")?.("source-two");
    });
    expect(onSelectSources).toHaveBeenLastCalledWith(
      expect.objectContaining({ sourceVersionIds: ["source-one", "source-two"] }),
    );

    rendered.rerender(
      <AuthoringBriefPanel
        course={course}
        initialSourcePolicy={null}
        sources={[
          readySource("source-one", "guide-one.pdf"),
          readySource("source-two", "guide-two.pdf"),
        ]}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onSelectSources={onSelectSources}
        onUploadSource={onUploadSource}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Remove attachment guide-one.pdf" }));
    await user.click(screen.getByRole("button", { name: "Remove attachment guide-three.pdf" }));
    await act(async () => {
      resolveUpload.get("guide-three.pdf")?.("source-three");
    });

    expect(onSelectSources).toHaveBeenLastCalledWith(
      expect.objectContaining({ sourceVersionIds: ["source-two"] }),
    );
    expect(screen.getByTestId("course-authoring-composer-attachments")).toHaveTextContent(
      "guide-two.pdf",
    );
    expect(screen.queryByText("guide-one.pdf")).not.toBeInTheDocument();
    expect(screen.queryByText("guide-three.pdf")).not.toBeInTheDocument();
  });

  it("attaches a ready upload only to the submitted request without changing session policy", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onSelectSources = vi.fn();
    let resolveUpload!: (sourceVersionId: string) => void;
    const onUploadSource = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveUpload = resolve;
        }),
    );
    const rendered = renderWith().render(
      <AuthoringBriefPanel
        course={course}
        initialSourcePolicy={null}
        onSubmit={onSubmit}
        onSelectSources={onSelectSources}
        onUploadSource={onUploadSource}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Open course tools" }));
    const fileInput = document.querySelector('input[type="file"]');
    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [new File(["guide"], "guide.pdf", { type: "application/pdf" })] },
    });
    expect(onUploadSource).toHaveBeenCalledOnce();
    await act(async () => {
      resolveUpload("source-1");
    });
    rendered.rerender(
      <AuthoringBriefPanel
        course={course}
        initialSourcePolicy={null}
        sources={[readySource("source-1", "guide.pdf")]}
        onSubmit={onSubmit}
        onSelectSources={onSelectSources}
        onUploadSource={onUploadSource}
      />,
    );
    const input = screen.getByTestId("course-authoring-brief-input");
    await user.type(input, "Use the guide");
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Send" })).toBeEnabled());

    await user.click(screen.getByRole("button", { name: "Send" }));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      attachedSourceVersionIds: ["source-1"],
      sourcePolicy: { sourceVersionIds: ["source-1"] },
    });
    expect(screen.queryByTestId("course-authoring-composer-attachments")).toBeNull();

    await user.type(input, "Create a quiz");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(onSubmit.mock.calls[1]?.[0]).toMatchObject({
      attachedSourceVersionIds: [],
      sourcePolicy: { sourceVersionIds: ["source-1"] },
    });
    expect(onSelectSources).toHaveBeenCalledWith(
      expect.objectContaining({ sourceVersionIds: ["source-1"] }),
    );
  });

  it("blocks send while a previously selected source is still processing", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onSelectSources = vi.fn();
    const processingSource = {
      ...readySource("source-1", "guide.pdf"),
      status: "processing" as const,
    };
    const policy = {
      sourceVersionIds: [processingSource.id],
      webEnabled: false,
      generalKnowledgeEnabled: true,
      researchDepth: "standard" as const,
      requiredSectionIds: [],
      excludedSectionIds: [],
    };
    const rendered = renderWith().render(
      <AuthoringBriefPanel
        course={course}
        initialSourcePolicy={policy}
        sources={[processingSource]}
        onSubmit={onSubmit}
        onSelectSources={onSelectSources}
      />,
    );
    await user.type(screen.getByTestId("course-authoring-brief-input"), "Use the guide");
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();

    rendered.rerender(
      <AuthoringBriefPanel
        course={course}
        initialSourcePolicy={policy}
        sources={[readySource("source-1", "guide.pdf")]}
        onSubmit={onSubmit}
        onSelectSources={onSelectSources}
      />,
    );
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();

    rendered.rerender(
      <AuthoringBriefPanel
        course={course}
        initialSourcePolicy={policy}
        sources={[processingSource]}
        onSubmit={onSubmit}
        onSelectSources={onSelectSources}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Remove attachment guide.pdf" }));
    expect(onSelectSources).toHaveBeenLastCalledWith(
      expect.objectContaining({ sourceVersionIds: [] }),
    );
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
  });

  it("shows a failed selected file that blocks sending and allows removing it", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onSelectSources = vi.fn();
    renderWith().render(
      <AuthoringBriefPanel
        course={course}
        initialSourcePolicy={{
          sourceVersionIds: ["failed-source", "ready-source"],
          webEnabled: false,
          generalKnowledgeEnabled: true,
          researchDepth: "standard",
          requiredSectionIds: [],
          excludedSectionIds: [],
        }}
        sources={[
          { ...readySource("failed-source", "older-upload.pdf"), status: "failed" },
          readySource("ready-source", "current-upload.pdf"),
        ]}
        onSubmit={onSubmit}
        onSelectSources={onSelectSources}
      />,
    );
    await user.type(screen.getByTestId("course-authoring-brief-input"), "Use the current guide");
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    expect(screen.getByTestId("course-authoring-composer-attachments")).toHaveTextContent(
      "older-upload.pdf",
    );
    expect(screen.getByTestId("course-authoring-composer-attachments")).toHaveTextContent("Failed");
    await user.click(screen.getByRole("button", { name: "Remove attachment older-upload.pdf" }));
    expect(onSelectSources).toHaveBeenLastCalledWith(
      expect.objectContaining({ sourceVersionIds: ["ready-source"] }),
    );
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        sourcePolicy: expect.objectContaining({ sourceVersionIds: ["ready-source"] }),
        attachedSourceVersionIds: [],
      }),
    );
  });

  it("restores only an unsent uploaded file after reload and clears it when sent", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onUploadSource = vi.fn().mockResolvedValue("source-unsent");
    const sessionId = "session-unsent-upload-reload";
    const unrelatedSource: SourceView = {
      id: "source-already-selected",
      name: "already-selected.pdf",
      status: "ready",
      selected: true,
      mediaType: "application/pdf",
      readableSections: 1,
      totalSections: 1,
      warning: null,
      sections: [],
    };
    const renderPanel = (submit = onSubmit) =>
      renderWith().render(
        <AuthoringBriefPanel
          course={course}
          sessionId={sessionId}
          initialSourcePolicy={{
            sourceVersionIds: [unrelatedSource.id],
            webEnabled: false,
            generalKnowledgeEnabled: true,
            researchDepth: "standard",
            requiredSectionIds: [],
            excludedSectionIds: [],
          }}
          sources={[unrelatedSource, readySource("source-unsent", "unsent-guide.pdf")]}
          onSubmit={submit}
          onSelectSources={vi.fn()}
          onUploadSource={onUploadSource}
        />,
      );

    const firstRender = renderPanel();
    await user.click(screen.getByRole("button", { name: "Open course tools" }));
    const fileInput = document.querySelector('input[type="file"]');
    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [new File(["guide"], "unsent-guide.pdf", { type: "application/pdf" })] },
    });
    await vi.waitFor(() =>
      expect(screen.getByTestId("course-authoring-composer-attachments")).toHaveTextContent(
        "unsent-guide.pdf",
      ),
    );
    await vi.waitFor(() =>
      expect(
        screen.getByTestId("course-authoring-composer-attachments").querySelector(".animate-spin"),
      ).toBeNull(),
    );
    firstRender.unmount();

    renderPanel();
    const restored = screen.getByTestId("course-authoring-composer-attachments");
    expect(restored).toHaveTextContent("unsent-guide.pdf");
    expect(restored).not.toHaveTextContent("already-selected.pdf");
    expect(restored.textContent?.match(/unsent-guide\.pdf/g)).toHaveLength(1);

    await user.type(screen.getByTestId("course-authoring-brief-input"), "Use this guide");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0]?.[0].attachedSourceVersionIds).toEqual(["source-unsent"]);
    expect(screen.queryByTestId("course-authoring-composer-attachments")).toBeNull();
  });

  it("clears the instruction before the asynchronous submit settles", async () => {
    const user = userEvent.setup();
    let resolveSubmit!: () => void;
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        }),
    );

    renderWith().render(
      <AuthoringBriefPanel
        course={course}
        initialSourcePolicy={{
          sourceVersionIds: [],
          webEnabled: true,
          generalKnowledgeEnabled: false,
          researchDepth: "standard",
          requiredSectionIds: [],
          excludedSectionIds: [],
        }}
        onSubmit={onSubmit}
        onSelectSources={vi.fn()}
      />,
    );

    const input = screen.getByTestId("course-authoring-brief-input");
    await user.type(input, "Create a safety course");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(input).toHaveValue("");
    resolveSubmit();
  });

  it("keeps the instruction when the parent rejects the request", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error("request failed"));
    renderWith().render(
      <AuthoringBriefPanel
        course={course}
        initialSourcePolicy={{
          sourceVersionIds: [],
          webEnabled: true,
          generalKnowledgeEnabled: false,
          researchDepth: "standard",
          requiredSectionIds: [],
          excludedSectionIds: [],
        }}
        onSubmit={onSubmit}
        onSelectSources={vi.fn()}
      />,
    );

    const input = screen.getByTestId("course-authoring-brief-input");
    await user.type(input, "Create a safety course");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(input).toHaveValue("Create a safety course");
  });

  it("clears the attachment chip before the asynchronous submit settles", async () => {
    const user = userEvent.setup();
    let resolveSubmit!: () => void;
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    let resolveUpload!: (sourceVersionId: string) => void;
    const onUploadSource = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveUpload = resolve;
        }),
    );

    const rendered = renderWith().render(
      <AuthoringBriefPanel
        course={course}
        initialSourcePolicy={null}
        onSubmit={onSubmit}
        onSelectSources={vi.fn()}
        onUploadSource={onUploadSource}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Open course tools" }));
    const fileInput = document.querySelector('input[type="file"]');
    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [new File(["guide"], "guide.pdf", { type: "application/pdf" })] },
    });
    expect(onUploadSource).toHaveBeenCalledOnce();
    await act(async () => {
      resolveUpload("source-1");
    });
    rendered.rerender(
      <AuthoringBriefPanel
        course={course}
        initialSourcePolicy={null}
        sources={[readySource("source-1", "guide.pdf")]}
        onSubmit={onSubmit}
        onSelectSources={vi.fn()}
        onUploadSource={onUploadSource}
      />,
    );

    const input = screen.getByTestId("course-authoring-brief-input");
    await user.type(input, "Use the guide");
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Send" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(screen.queryByTestId("course-authoring-composer-attachments")).toBeNull();
    resolveSubmit();
  });

  it("restores the attachment chip when the parent rejects the request", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error("request failed"));
    let resolveUpload!: (sourceVersionId: string) => void;
    const onUploadSource = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveUpload = resolve;
        }),
    );

    const rendered = renderWith().render(
      <AuthoringBriefPanel
        course={course}
        initialSourcePolicy={null}
        onSubmit={onSubmit}
        onSelectSources={vi.fn()}
        onUploadSource={onUploadSource}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Open course tools" }));
    const fileInput = document.querySelector('input[type="file"]');
    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [new File(["guide"], "guide.pdf", { type: "application/pdf" })] },
    });
    expect(onUploadSource).toHaveBeenCalledOnce();
    await act(async () => {
      resolveUpload("source-1");
    });
    rendered.rerender(
      <AuthoringBriefPanel
        course={course}
        initialSourcePolicy={null}
        sources={[readySource("source-1", "guide.pdf")]}
        onSubmit={onSubmit}
        onSelectSources={vi.fn()}
        onUploadSource={onUploadSource}
      />,
    );

    const input = screen.getByTestId("course-authoring-brief-input");
    await user.type(input, "Use the guide");
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Send" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Send" }));
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());

    expect(screen.getByTestId("course-authoring-composer-attachments")).toBeInTheDocument();
  });

  it("uploads a pasted valid file the same way as the attach-file control", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onUploadSource = vi.fn().mockResolvedValue("source-1");

    renderWith().render(
      <AuthoringBriefPanel
        course={course}
        initialSourcePolicy={null}
        onSubmit={onSubmit}
        onSelectSources={vi.fn()}
        onUploadSource={onUploadSource}
      />,
    );

    const input = screen.getByTestId("course-authoring-brief-input");
    fireEvent.paste(input, {
      clipboardData: {
        files: [new File(["guide"], "guide.pdf", { type: "application/pdf" })],
      },
    });

    await vi.waitFor(() => expect(onUploadSource).toHaveBeenCalledOnce());
    expect(onUploadSource).toHaveBeenCalledWith(
      expect.objectContaining({ name: "guide.pdf", type: "application/pdf" }),
    );
    await vi.waitFor(() =>
      expect(screen.getByTestId("course-authoring-composer-attachments")).toBeInTheDocument(),
    );
  });

  it("shows a validation error and opens tools when a pasted file is unsupported", async () => {
    const onSubmit = vi.fn();
    const onUploadSource = vi.fn();

    renderWith().render(
      <AuthoringBriefPanel
        course={course}
        initialSourcePolicy={null}
        onSubmit={onSubmit}
        onSelectSources={vi.fn()}
        onUploadSource={onUploadSource}
      />,
    );

    const input = screen.getByTestId("course-authoring-brief-input");
    fireEvent.paste(input, {
      clipboardData: {
        files: [new File(["binary"], "video.mp4", { type: "video/mp4" })],
      },
    });

    expect(
      await screen.findByText("Choose a PDF, DOCX, plain text or Markdown file."),
    ).toBeInTheDocument();
    expect(onUploadSource).not.toHaveBeenCalled();
  });
});
