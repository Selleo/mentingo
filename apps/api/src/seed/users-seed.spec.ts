import { SELF_ONBOARDING_DEMO_PEOPLE, SYSTEM_ROLE_SLUGS } from "@repo/shared";

describe("Self-onboarding demo people", () => {
  const original = process.env.SELF_ONBOARDING_DEMO;

  afterEach(() => {
    if (original === undefined) delete process.env.SELF_ONBOARDING_DEMO;
    else process.env.SELF_ONBOARDING_DEMO = original;
    jest.resetModules();
  });

  it("uses the same seeded identities as the recording fixture with realistic names", async () => {
    process.env.SELF_ONBOARDING_DEMO = "1";
    jest.resetModules();
    const { admin, students, contentCreators, trainers } = await import("./users-seed");
    const people = [...admin, ...students, ...contentCreators, ...trainers];

    for (const [role, person] of Object.entries(SELF_ONBOARDING_DEMO_PEOPLE)) {
      expect(people).toContainEqual({ ...person, roleSlug: role });
    }
    expect(new Set(people.map((person) => person.email)).size).toBe(people.length);
    expect(
      people.every(
        (person) =>
          !/e2e|worker|readonly|admin|student/i.test(`${person.firstName} ${person.lastName}`),
      ),
    ).toBe(true);
  });

  it("preserves normal seed identities outside recordings", async () => {
    delete process.env.SELF_ONBOARDING_DEMO;
    jest.resetModules();
    const { admin, students } = await import("./users-seed");
    expect(admin[0]).toMatchObject({
      email: "admin@example.com",
      roleSlug: SYSTEM_ROLE_SLUGS.ADMIN,
    });
    expect(students[0].email).toBe("student@example.com");
  });
});
