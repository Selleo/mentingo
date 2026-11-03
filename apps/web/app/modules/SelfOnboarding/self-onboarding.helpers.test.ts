import { existsSync } from "node:fs";
import { resolve } from "node:path";

import {
  SELF_ONBOARDING_AREAS,
  SELF_ONBOARDING_EXCLUDED_ROUTES,
  validateSelfOnboardingAreas,
} from "@repo/shared";
import { describe, expect, it } from "vitest";

import { routes } from "../../../routes";

import {
  getHelpdeskPageKey,
  helpdeskTutorialPath,
  helpdeskDomainLabel,
  readHelpdeskTutorialReference,
} from "./self-onboarding.helpers";

import type { DefineRouteFunction } from "@remix-run/dev/dist/config/routes";

describe("safe Helpdesk context", () => {
  it("projects product page keys without forwarding resource IDs or raw URLs", () => {
    expect(getHelpdeskPageKey("/admin/beta-courses/private-id/authoring")).toBe(
      "admin.course.curriculum",
    );
    expect(getHelpdeskPageKey("/admin/development-paths/private-id")).toBe("development-paths");
    expect(getHelpdeskPageKey("/course/private-id/lesson/another-private-id")).toBe(
      "student.course",
    );
    expect(getHelpdeskPageKey("/admin/users/private-person")).toBe("users");
    expect(getHelpdeskPageKey("/news/private-id/edit")).toBe("news");
    expect(getHelpdeskPageKey("/articles/private-id")).toBe("articles");
    expect(getHelpdeskPageKey("/admin/automations/private-id")).toBe("automations");
    expect(getHelpdeskPageKey("/admin/users-not-a-route/private-person")).toBeUndefined();
    expect(getHelpdeskPageKey("https://tenant.example/admin/users/private-person")).toBeUndefined();
    expect(getHelpdeskPageKey("//other.example/news/private-id")).toBeUndefined();
    expect(getHelpdeskPageKey("/settings?secret=user-id")).toBe("settings");
  });
  it("encodes stable identities in canonical Helpdesk links", () => {
    expect(helpdeskTutorialPath("course-authoring.publish", "review")).toBe(
      "/helpdesk/tutorials/course-authoring.publish?chapter=review",
    );
  });

  it("resolves same-tenant tutorial and chapter references", () => {
    expect(
      readHelpdeskTutorialReference(
        "/helpdesk/tutorials/course-authoring.publish?chapter=review",
        "https://tenant.example",
      ),
    ).toEqual({ key: "course-authoring.publish", chapterId: "review" });
    expect(
      readHelpdeskTutorialReference(
        "https://tenant.example/helpdesk/tutorials/course-authoring.publish",
        "https://tenant.example",
      ),
    ).toEqual({ key: "course-authoring.publish" });
  });

  it.each([
    "https://other.example/helpdesk/tutorials/example",
    "//other.example/helpdesk/tutorials/example",
    "https://user:secret@tenant.example/helpdesk/tutorials/example",
    "/helpdesk/tutorials/example?chapter=review&chapter=other",
    "/helpdesk/tutorials/example?videoUrl=https://other.example",
    "/helpdesk/tutorials/example#chapter",
    "/helpdesk/tutorials/example?chapter=../../private",
    "/helpdesk/tutorials/example/another",
  ])("rejects unsupported or foreign tutorial references: %s", (url) => {
    expect(readHelpdeskTutorialReference(url, "https://tenant.example")).toBeNull();
  });
});

describe("app-wide self-onboarding registry", () => {
  it("maps every routed page or explicitly excludes it as a utility", () => {
    const parents: string[] = [];
    const pages: string[] = [];
    const collect = ((
      path: string,
      _file: string,
      optionsOrChildren?: unknown,
      children?: () => void,
    ) => {
      const nested = typeof optionsOrChildren === "function" ? optionsOrChildren : children;
      parents.push(path);
      if (nested) nested();
      else
        pages.push(
          "/" +
            parents
              .filter(Boolean)
              .join("/")
              .replace(/:[^/]+/g, "private-id"),
        );
      parents.pop();
    }) as DefineRouteFunction;
    routes((callback) => {
      callback(collect);
      return {};
    });
    expect(pages.length).toBeGreaterThan(60);
    const unmatched = pages.filter(
      (path) =>
        !getHelpdeskPageKey(path) &&
        !SELF_ONBOARDING_EXCLUDED_ROUTES.some(
          (item) => path === item.prefix || path.startsWith(item.prefix + "/"),
        ),
    );
    expect(unmatched).toEqual([]);
  });

  it("points every area at an existing business specification", () => {
    for (const area of SELF_ONBOARDING_AREAS) {
      for (const spec of area.specPaths) {
        expect(existsSync(resolve(process.cwd(), "../..", spec)), spec).toBe(true);
      }
    }
  });

  it("rejects duplicate area identities and ambiguous route prefixes", () => {
    const fixture = {
      schemaVersion: 1,
      areas: structuredClone([...SELF_ONBOARDING_AREAS]),
      excludedRoutes: [],
    };
    fixture.areas.push(structuredClone(fixture.areas[0]));
    expect(() => validateSelfOnboardingAreas(fixture)).toThrow(/duplicate/);
    fixture.areas.pop();
    fixture.areas[1].routes.push(structuredClone(fixture.areas[0].routes[0]));
    expect(() => validateSelfOnboardingAreas(fixture)).toThrow(/duplicate/);
  });

  it("uses published labels, with readable registry and unknown-area fallbacks", () => {
    expect(helpdeskDomainLabel({ domain: "news", domainLabel: "Aktualności" })).toBe("Aktualności");
    expect(helpdeskDomainLabel({ domain: "news" })).toBe("News");
    expect(helpdeskDomainLabel({ domain: "future-plugin.area", domainLabel: null })).toBe(
      "Future Plugin Area",
    );
  });
});
