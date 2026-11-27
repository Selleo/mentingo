import { AUDIT_ENGINE, AUDIT_IMPACT, AUDIT_OUTCOME } from "./wcag-audit.types";

import type { AuditImpact, AuditNode, AuditRuleResult } from "./wcag-audit.types";
import type { Page } from "@playwright/test";

/**
 * Checks axe-core does not do. They look for likely failures; anything a script cannot decide is
 * reported as `needs-review`, never as a pass of the criterion.
 */
export const CUSTOM_RULE = {
  PAGE_TITLE: "mentingo-page-title",
  PAGE_TITLE_UNIQUE: "mentingo-page-title-unique",
  FOCUS_ON_HIDDEN_ELEMENT: "mentingo-focus-on-hidden-element",
  FOCUS_INDICATOR: "mentingo-focus-indicator",
  KEYBOARD_TRAP: "mentingo-keyboard-trap",
  SKIP_LINK: "mentingo-skip-link",
  POINTER_ONLY_CONTROL: "mentingo-pointer-only-control",
  REFLOW_320: "mentingo-reflow-320",
  REFLOW_320_REGION: "mentingo-reflow-320-region",
  TEXT_SPACING: "mentingo-text-spacing",
} as const;

const MAX_REPORTED_NODES = 25;
const MAX_TAB_STOPS = 60;
const REFLOW_VIEWPORT = { width: 320, height: 800 };

type CustomResultInput = {
  ruleId: string;
  criteria: string[];
  help: string;
  failingNodes: AuditNode[];
  failingOutcome: typeof AUDIT_OUTCOME.VIOLATION | typeof AUDIT_OUTCOME.NEEDS_REVIEW;
  impact: AuditImpact;
};

const buildCustomResult = ({
  ruleId,
  criteria,
  help,
  failingNodes,
  failingOutcome,
  impact,
}: CustomResultInput): AuditRuleResult => ({
  ruleId,
  engine: AUDIT_ENGINE.MENTINGO,
  outcome: failingNodes.length ? failingOutcome : AUDIT_OUTCOME.PASS,
  criteria,
  tags: criteria.map((criterion) => `wcag${criterion.replaceAll(".", "")}`),
  impact: failingNodes.length ? impact : null,
  help,
  nodes: failingNodes.slice(0, MAX_REPORTED_NODES),
});

const waitForLayout = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );

export const checkPageTitle = async (page: Page) => {
  const title = (await page.title()).trim();

  return {
    title,
    result: buildCustomResult({
      ruleId: CUSTOM_RULE.PAGE_TITLE,
      criteria: ["2.4.2"],
      help: "The page has a non-empty <title>",
      failingNodes: title ? [] : [{ target: "title", html: "<title></title>" }],
      failingOutcome: AUDIT_OUTCOME.VIOLATION,
      impact: AUDIT_IMPACT.SERIOUS,
    }),
  };
};

const TAB_STOP_VISIBILITY = {
  VISIBLE: "visible",
  /** Rendered but fully transparent, e.g. a file input laid over a styled drop zone. */
  TRANSPARENT: "transparent",
  HIDDEN: "hidden",
} as const;

type TabStop = AuditNode & {
  key: string;
  visibility: (typeof TAB_STOP_VISIBILITY)[keyof typeof TAB_STOP_VISIBILITY];
  hasIndicator: boolean;
  isSamePageLink: boolean;
};

/** Walks the page with Tab from the top and records every focus stop. */
export const checkKeyboardNavigation = async (page: Page): Promise<AuditRuleResult[]> => {
  await page.evaluate(() => {
    const start = document.createElement("div");
    start.tabIndex = -1;
    start.id = "a11y-audit-tab-start";
    document.body.prepend(start);
    start.focus();
  });

  const stops: TabStop[] = [];
  let repeatedStops = 0;
  let trappedStop: TabStop | null = null;

  for (let index = 0; index < MAX_TAB_STOPS; index += 1) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate((visibilityValues): TabStop | null => {
      const element = document.activeElement;
      if (!element || element === document.body || element.id === "a11y-audit-tab-start") {
        return null;
      }

      const describeTarget = (node: Element) => {
        const testId = node.getAttribute("data-testid");
        if (testId) return `[data-testid="${testId}"]`;
        if (node.id) return `#${CSS.escape(node.id)}`;

        const path: string[] = [];
        let current: Element | null = node;
        while (current && current !== document.body && path.length < 5) {
          const parent: Element | null = current.parentElement;
          const tagName = current.tagName.toLowerCase();
          const siblings = parent
            ? Array.from(parent.children).filter((child) => child.tagName === current?.tagName)
            : [];
          const position =
            siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(current) + 1})` : "";
          path.unshift(`${tagName}${position}`);
          current = parent;
        }
        return path.join(" > ");
      };

      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const isHiddenByAncestor = Boolean(element.closest('[aria-hidden="true"], [inert]'));
      const hasTransparentAncestor = (() => {
        let current: Element | null = element;
        while (current) {
          if (getComputedStyle(current).opacity === "0") return true;
          current = current.parentElement;
        }
        return false;
      })();
      const isOutsideDocument =
        rect.right <= 0 ||
        rect.bottom + window.scrollY <= 0 ||
        rect.left >= document.documentElement.scrollWidth;
      const isHidden =
        rect.width <= 1 ||
        rect.height <= 1 ||
        style.visibility === "hidden" ||
        isHiddenByAncestor ||
        isOutsideDocument;
      const visibility = (() => {
        if (isHidden) return visibilityValues.HIDDEN;
        if (hasTransparentAncestor) return visibilityValues.TRANSPARENT;
        return visibilityValues.VISIBLE;
      })();
      const hasOutline =
        style.outlineStyle !== "none" &&
        parseFloat(style.outlineWidth) > 0 &&
        style.outlineColor !== "rgba(0, 0, 0, 0)";
      const hasShadow = style.boxShadow !== "none";
      const href = element.getAttribute("href") ?? "";
      const html = element.outerHTML.slice(0, 200);
      // Elements can share a data-testid (list items), so tag each stop to tell them apart.
      if (!element.hasAttribute("data-a11y-audit-stop")) {
        const stopCount = document.querySelectorAll("[data-a11y-audit-stop]").length;
        element.setAttribute("data-a11y-audit-stop", String(stopCount + 1));
      }

      return {
        key: element.getAttribute("data-a11y-audit-stop") ?? "",
        target: describeTarget(element),
        html,
        visibility,
        hasIndicator: hasOutline || hasShadow,
        isSamePageLink: element.tagName === "A" && href.startsWith("#") && href.length > 1,
      };
    }, TAB_STOP_VISIBILITY);

    if (!stop) break;

    const previous = stops.at(-1);
    if (previous && previous.key === stop.key) {
      repeatedStops += 1;
      if (repeatedStops >= 2) {
        trappedStop = stop;
        break;
      }
      continue;
    }
    repeatedStops = 0;
    if (stops.some(({ key }) => key === stop.key)) break;
    stops.push(stop);
  }

  await page.evaluate(() => {
    document.getElementById("a11y-audit-tab-start")?.remove();
    document
      .querySelectorAll("[data-a11y-audit-stop]")
      .forEach((element) => element.removeAttribute("data-a11y-audit-stop"));
  });

  const toNode = ({ target, html }: TabStop, summary: string): AuditNode => ({
    target,
    html,
    summary,
  });
  const hiddenStops = stops.filter(({ visibility }) => visibility === TAB_STOP_VISIBILITY.HIDDEN);
  const transparentStops = stops.filter(
    ({ visibility }) => visibility === TAB_STOP_VISIBILITY.TRANSPARENT,
  );
  const stopsWithoutIndicator = stops.filter(
    ({ visibility, hasIndicator }) => visibility === TAB_STOP_VISIBILITY.VISIBLE && !hasIndicator,
  );
  const hasSkipLink = stops.slice(0, 3).some(({ isSamePageLink }) => isSamePageLink);

  return [
    buildCustomResult({
      ruleId: CUSTOM_RULE.FOCUS_ON_HIDDEN_ELEMENT,
      criteria: ["2.4.7", "2.4.3"],
      help: "Keyboard focus never lands on an element the user cannot see",
      failingNodes: hiddenStops.map((stop) =>
        toNode(
          stop,
          "Tab stop is zero-sized, visibility:hidden, off-screen or inside aria-hidden/inert",
        ),
      ),
      failingOutcome: AUDIT_OUTCOME.VIOLATION,
      impact: AUDIT_IMPACT.SERIOUS,
    }),
    buildCustomResult({
      ruleId: CUSTOM_RULE.FOCUS_INDICATOR,
      criteria: ["2.4.7"],
      help: "Focused element shows an outline or ring (heuristic: focus styled by other means needs a manual check)",
      failingNodes: [
        ...stopsWithoutIndicator.map((stop) =>
          toNode(stop, "No outline or box-shadow while focused"),
        ),
        ...transparentStops.map((stop) =>
          toNode(stop, "Transparent element takes focus; check its container shows focus"),
        ),
      ],
      failingOutcome: AUDIT_OUTCOME.NEEDS_REVIEW,
      impact: AUDIT_IMPACT.MODERATE,
    }),
    buildCustomResult({
      ruleId: CUSTOM_RULE.KEYBOARD_TRAP,
      criteria: ["2.1.2"],
      help: "Tab moves focus away from every element",
      failingNodes: trappedStop
        ? [toNode(trappedStop, "Focus stayed on this element after three Tab presses")]
        : [],
      failingOutcome: AUDIT_OUTCOME.VIOLATION,
      impact: AUDIT_IMPACT.CRITICAL,
    }),
    buildCustomResult({
      ruleId: CUSTOM_RULE.SKIP_LINK,
      criteria: ["2.4.1"],
      help: "A skip link is among the first three Tab stops (landmarks alone may also satisfy 2.4.1)",
      failingNodes: hasSkipLink
        ? []
        : [{ target: "body", html: "", summary: "No same-page link in the first three Tab stops" }],
      failingOutcome: AUDIT_OUTCOME.NEEDS_REVIEW,
      impact: AUDIT_IMPACT.MODERATE,
    }),
  ];
};

/** Elements styled as clickable (pointer cursor) that the keyboard cannot reach. */
export const checkPointerOnlyControls = async (page: Page): Promise<AuditRuleResult> => {
  const nodes = await page.evaluate(() => {
    const interactiveSelector =
      'a[href], button, input, select, textarea, summary, label, [tabindex]:not([tabindex="-1"]), [contenteditable="true"], iframe';
    const describeTarget = (node: Element) => {
      const testId = node.getAttribute("data-testid");
      if (testId) return `[data-testid="${testId}"]`;
      const classes = Array.from(node.classList).slice(0, 2).join(".");
      return `${node.tagName.toLowerCase()}${classes ? `.${classes}` : ""}`;
    };

    return Array.from(document.body.querySelectorAll("*"))
      .filter((element) => {
        if (element.closest(interactiveSelector)) return false;
        if (element.closest('[aria-hidden="true"], [inert]')) return false;
        const style = getComputedStyle(element);
        if (style.cursor !== "pointer") return false;
        const parent = element.parentElement;
        if (parent && getComputedStyle(parent).cursor === "pointer") return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden";
      })
      .map((element) => ({
        target: describeTarget(element),
        html: element.outerHTML.slice(0, 200),
        summary: "Pointer cursor on an element that is not focusable with the keyboard",
      }));
  });

  return buildCustomResult({
    ruleId: CUSTOM_RULE.POINTER_ONLY_CONTROL,
    criteria: ["2.1.1"],
    help: "Clickable-looking elements can be reached with the keyboard (heuristic)",
    failingNodes: nodes,
    failingOutcome: AUDIT_OUTCOME.NEEDS_REVIEW,
    impact: AUDIT_IMPACT.SERIOUS,
  });
};

/**
 * Content wider than a 320 CSS px viewport (400% zoom of a 1280 px screen). Page-level horizontal
 * scrolling fails 1.4.10; a region that scrolls or clips on its own needs a human to judge it.
 * Tables, media, maps and code are exempt (WCAG allows two-dimensional scrolling for them).
 */
export const checkReflow = async (page: Page): Promise<AuditRuleResult[]> => {
  const originalViewport = page.viewportSize();
  await page.setViewportSize(REFLOW_VIEWPORT);
  await waitForLayout(page);

  const { pageScrollNodes, regionNodes } = await page.evaluate(() => {
    const exemptSelector =
      'table, [role="table"], [role="grid"], [role="treegrid"], pre, code, canvas, video, iframe, svg, [role="img"], .fc';
    const viewportWidth = window.innerWidth;
    const isPageScroller = (element: Element) =>
      element === document.documentElement ||
      element === document.body ||
      element.getBoundingClientRect().width >= viewportWidth - 20;
    const nearestOverflowAncestor = (element: Element) => {
      let current = element.parentElement;
      while (current && current !== document.documentElement) {
        if (getComputedStyle(current).overflowX !== "visible") return current;
        current = current.parentElement;
      }
      return document.documentElement;
    };
    const describeTarget = (node: Element) => {
      const testId = node.getAttribute("data-testid");
      if (testId) return `[data-testid="${testId}"]`;
      const classes = Array.from(node.classList).slice(0, 2).join(".");
      return `${node.tagName.toLowerCase()}${classes ? `.${classes}` : ""}`;
    };

    const offenders = Array.from(document.body.querySelectorAll("*")).filter((element) => {
      if (element.closest(exemptSelector)) return false;
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      if (rect.right <= viewportWidth + 1) return false;
      return getComputedStyle(element).position !== "fixed";
    });
    const outermost = offenders.filter(
      (element) => !offenders.some((other) => other !== element && other.contains(element)),
    );

    const pageScroll: { target: string; html: string; summary: string }[] = [];
    const region: { target: string; html: string; summary: string }[] = [];
    outermost.forEach((element) => {
      const container = nearestOverflowAncestor(element);
      const { overflowX } = getComputedStyle(container);
      const canScroll =
        container === document.documentElement || overflowX === "auto" || overflowX === "scroll";
      const overflowsContainer = container.scrollWidth > container.clientWidth + 1;
      const right = Math.round(element.getBoundingClientRect().right);
      const node = { target: describeTarget(element), html: element.outerHTML.slice(0, 200) };

      // Positioned off-canvas (e.g. a closed drawer): nothing to scroll to, nothing cut off.
      if (container === document.documentElement && !overflowsContainer) return;

      if (canScroll && overflowsContainer && isPageScroller(container)) {
        pageScroll.push({
          ...node,
          summary: `Right edge at ${right}px: the page scrolls horizontally at ${viewportWidth}px`,
        });
        return;
      }
      region.push({
        ...node,
        summary:
          canScroll && overflowsContainer
            ? `Right edge at ${right}px: scrolls horizontally inside ${describeTarget(container)}`
            : `Right edge at ${right}px: cut off by ${describeTarget(container)}`,
      });
    });

    return { pageScrollNodes: pageScroll, regionNodes: region };
  });

  if (originalViewport) await page.setViewportSize(originalViewport);
  await waitForLayout(page);

  return [
    buildCustomResult({
      ruleId: CUSTOM_RULE.REFLOW_320,
      criteria: ["1.4.10"],
      help: "The page does not scroll horizontally in a 320 CSS px wide viewport",
      failingNodes: pageScrollNodes,
      failingOutcome: AUDIT_OUTCOME.VIOLATION,
      impact: AUDIT_IMPACT.SERIOUS,
    }),
    buildCustomResult({
      ruleId: CUSTOM_RULE.REFLOW_320_REGION,
      criteria: ["1.4.10"],
      help: "No region scrolls sideways or cuts content off at 320 CSS px (heuristic)",
      failingNodes: regionNodes,
      failingOutcome: AUDIT_OUTCOME.NEEDS_REVIEW,
      impact: AUDIT_IMPACT.MODERATE,
    }),
  ];
};

/** Text that gets cut off once the WCAG 1.4.12 spacing is applied. */
export const checkTextSpacing = async (page: Page): Promise<AuditRuleResult> => {
  const nodes = await page.evaluate(async () => {
    const isClippedText = (element: Element) => {
      const style = getComputedStyle(element);
      const clipsY = style.overflowY === "hidden" || style.overflowY === "clip";
      const clipsX = style.overflowX === "hidden" || style.overflowX === "clip";
      const hasOwnText = Array.from(element.childNodes).some(
        (child) => child.nodeType === Node.TEXT_NODE && child.textContent?.trim(),
      );
      if (!hasOwnText) return false;
      return (
        (clipsY && element.scrollHeight > element.clientHeight + 2) ||
        (clipsX &&
          element.scrollWidth > element.clientWidth + 2 &&
          style.textOverflow !== "ellipsis")
      );
    };
    const describeTarget = (node: Element) => {
      const testId = node.getAttribute("data-testid");
      if (testId) return `[data-testid="${testId}"]`;
      const classes = Array.from(node.classList).slice(0, 2).join(".");
      return `${node.tagName.toLowerCase()}${classes ? `.${classes}` : ""}`;
    };
    const elements = Array.from(document.body.querySelectorAll("*"));
    const clippedBefore = new Set(elements.filter(isClippedText));

    const style = document.createElement("style");
    style.id = "a11y-audit-text-spacing";
    style.textContent =
      "* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }";
    document.head.append(style);
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );

    const clippedAfter = elements.filter(
      (element) => !clippedBefore.has(element) && isClippedText(element),
    );
    const result = clippedAfter.map((element) => ({
      target: describeTarget(element),
      html: element.outerHTML.slice(0, 200),
      summary: "Text is clipped after applying WCAG 1.4.12 text spacing",
    }));
    style.remove();
    return result;
  });
  await waitForLayout(page);

  return buildCustomResult({
    ruleId: CUSTOM_RULE.TEXT_SPACING,
    criteria: ["1.4.12"],
    help: "No text is cut off with increased line, letter, word and paragraph spacing (heuristic)",
    failingNodes: nodes,
    failingOutcome: AUDIT_OUTCOME.NEEDS_REVIEW,
    impact: AUDIT_IMPACT.MODERATE,
  });
};
