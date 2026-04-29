import { SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { and, eq, isNull } from "drizzle-orm";
import { omit } from "lodash";
import request from "supertest";

import { AuthService } from "src/auth/auth.service";
import { GroupService } from "src/group/group.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { groupUsers, userDetails, userOnboarding, users } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory, type UserWithCredentials } from "../../../test/factory/user.factory";
import { cookieFor, truncateTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

describe("UsersController (e2e)", () => {
  let app: INestApplication;
  let authService: AuthService;
  let groupService: GroupService;
  let testUser: UserWithCredentials;
  let testCookies: string;
  const testPassword = "password123";
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let userFactory: ReturnType<typeof createUserFactory>;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();
    app = testApp;
    authService = app.get(AuthService);
    groupService = app.get(GroupService);
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    userFactory = createUserFactory(db);
    settingsFactory = createSettingsFactory(db);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await settingsFactory.create({ userId: null });

    testUser = await userFactory
      .withCredentials({ password: testPassword })
      .withAdminSettings(db)
      .withAdminRole()
      .create();

    testCookies = await cookieFor(testUser, app);
  });

  describe("GET /user/all", () => {
    it("should return all users", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/user/all")
        .set("Cookie", testCookies)
        .expect(200);

      expect(response.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ...omit(testUser, "credentials", "avatarReference"),
            profilePictureUrl: null,
          }),
        ]),
      );
      expect(response.body.data.length).toBeGreaterThan(0);
    });
  });

  afterEach(async () => {
    await truncateTables(baseDb, ["users", "groups", "settings"]);
  });

  describe("GET /user?id=:id", () => {
    it("should return a user by id", async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/user?id=${testUser.id}`)
        .set("Cookie", testCookies)
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(response.body.data).toStrictEqual({
        ...omit(testUser, "credentials", "avatarReference"),
        profilePictureUrl: null,
        roleSlugs: [SYSTEM_ROLE_SLUGS.ADMIN],
        groups: [],
      });
    });

    it("should return 404 for non-existent user", async () => {
      await request(app.getHttpServer())
        .get(`/api/user?id=${crypto.randomUUID()}`)
        .set("Cookie", testCookies)
        .expect(404);
    });
  });

  describe("PATCH ?id=:id", () => {
    it("should update group for user", async () => {
      const updateData = await groupService.createGroup({ name: "Test group" });

      const response = await request(app.getHttpServer())
        .patch(`/api/user?id=${testUser.id}`)
        .set("Cookie", testCookies)
        .send({ groups: [updateData.id] })
        .expect(200);

      expect(response.body.data.groups[0].id).toBe(updateData.id);
    });

    it("should update user", async () => {
      const updateData = { email: "newemail@example.com" };

      const response = await request(app.getHttpServer())
        .patch(`/api/user?id=${testUser.id}`)
        .set("Cookie", testCookies)
        .send(updateData)
        .expect(200);

      expect(response.body.data.email).toBe(updateData.email);
    });

    it("should return 403 when updating another user", async () => {
      const anotherUser = await authService.register({
        email: "another@example.com",
        password: "password123",
        firstName: "Another",
        lastName: "User",
        language: "en",
      });
      await request(app.getHttpServer())
        .patch(`/api/user?id=${anotherUser.id}`)
        .set("Cookie", testCookies)
        .send({ email: "newemail@example.com" })
        .expect(403);
    });
  });

  describe("PATCH /user/change-password?id=:id", () => {
    it("should change password when old password is correct", async () => {
      const newPassword = "newPassword123@";

      await request(app.getHttpServer())
        .patch(`/api/user/change-password?id=${testUser.id}`)
        .set("Cookie", testCookies)
        .send({ oldPassword: testPassword, newPassword, confirmPassword: newPassword })
        .expect(200);

      const loginResponse = await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({
          email: testUser.email,
          password: newPassword,
        })
        .expect(201);

      expect(loginResponse.headers["set-cookie"]).toBeDefined();
    });

    it("should return 401 when old password is incorrect", async () => {
      const incorrectOldPassword = "wrongPassword";
      const newPassword = "newPassword123@";

      await request(app.getHttpServer())
        .patch(`/api/user/change-password?id=${testUser.id}`)
        .set("Cookie", testCookies)
        .send({ oldPassword: incorrectOldPassword, newPassword, confirmPassword: newPassword })
        .expect(401);
    });

    it("should return 403 when changing another user's password", async () => {
      const anotherUser = await authService.register({
        email: "another2@example.com",
        password: "Password123@",
        firstName: "Another",
        lastName: "User",
        language: "en",
      });

      const password = "Password2137@";

      await request(app.getHttpServer())
        .patch(`/api/user/change-password?id=${anotherUser.id}`)
        .set("Cookie", testCookies)
        .send({ oldPassword: "Password123@", newPassword: password, confirmPassword: password })
        .expect(403);
    });
  });

  describe("DELETE /user", () => {
    it("should fail to delete itself", async () => {
      await request(app.getHttpServer())
        .delete(`/api/user`)
        .send({ userIds: [testUser.id] })
        .set("Cookie", testCookies)
        .expect(400);
    });

    it("should delete user", async () => {
      const anotherUser = await authService.register({
        email: "another3@example.com",
        password: "password123",
        firstName: "Another",
        lastName: "User",
        language: "en",
      });

      await request(app.getHttpServer())
        .delete(`/api/user`)
        .send({ userIds: [anotherUser.id] })
        .set("Cookie", testCookies)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/user?id=${anotherUser.id}`)
        .set("Cookie", testCookies)
        .expect(404);
    });
  });
  describe("GET /user/details?userId=:id", () => {
    let cookies: string;

    beforeAll(async () => {
      await settingsFactory.create({ userId: null });

      const anotherUser = await authService.register({
        email: "another4@example.com",
        password: testPassword,
        firstName: "Another",
        lastName: "User",
        language: "en",
      });
      const loginResponse = await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({
          email: anotherUser.email,
          password: testPassword,
        })
        .expect(201);

      cookies = loginResponse.headers["set-cookie"];
    });
    it("should return user details", async () => {
      await request(app.getHttpServer())
        .get(`/api/user/details?userId=${testUser.id}`)
        .set("Cookie", cookies)
        .expect(200);
    });

    it("should return forbidden", async () => {
      const anotherUser2 = await authService.register({
        email: "another5@example.com",
        password: testPassword,
        firstName: "Another",
        lastName: "User",
        language: "en",
      });
      await request(app.getHttpServer())
        .get(`/api/user/details?userId=${anotherUser2.id}`)
        .set("Cookie", cookies)
        .expect(403);
    });
  });

  describe("PATCH /user/bulk/groups", () => {
    let firstUser: UserWithCredentials;
    let secondUser: UserWithCredentials;

    it("should update groups for multiple users", async () => {
      firstUser = {
        ...(await authService.register({
          email: "another6@example.com",
          password: testPassword,
          firstName: "Another",
          lastName: "User",
          language: "en",
        })),
        avatarReference: null,
      };

      secondUser = {
        ...(await authService.register({
          email: "another7@example.com",
          password: testPassword,
          firstName: "Another",
          lastName: "User",
          language: "en",
        })),
        avatarReference: null,
      };

      const updateData = await groupService.createGroup({
        name: "Test group",
      });

      await request(app.getHttpServer())
        .patch(`/api/user/bulk/groups`)
        .set("Cookie", testCookies)
        .send([
          { userId: firstUser.id, groups: [updateData.id] },
          { userId: secondUser.id, groups: [updateData.id] },
        ])
        .expect(200);
    });

    it("should return forbidden 403", async () => {
      firstUser = {
        ...(await authService.register({
          email: "another6@example.com",
          password: testPassword,
          firstName: "Another",
          lastName: "User",
          language: "en",
        })),
        avatarReference: null,
      };

      secondUser = {
        ...(await authService.register({
          email: "another7@example.com",
          password: testPassword,
          firstName: "Another",
          lastName: "User",
          language: "en",
        })),
        avatarReference: null,
      };

      const updateData = await groupService.createGroup({ name: "Test group" });

      const loginResponse = await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({
          email: firstUser.email,
          password: testPassword,
        })
        .expect(201);

      const cookies = loginResponse.headers["set-cookie"];

      await request(app.getHttpServer())
        .patch(`/api/user/bulk/groups`)
        .set("Cookie", cookies)
        .send([
          { userId: firstUser.id, groups: [updateData.id] },
          { userId: secondUser.id, groups: [updateData.id] },
        ])
        .expect(403);
    });
  });

  describe("PATCH /user/bulk/roles", () => {
    it("should update roles for multiple users", async () => {
      const firstUser = await authService.register({
        email: "bulk-roles-1@example.com",
        password: testPassword,
        firstName: "Bulk",
        lastName: "UserOne",
        language: "en",
      });

      const secondUser = await authService.register({
        email: "bulk-roles-2@example.com",
        password: testPassword,
        firstName: "Bulk",
        lastName: "UserTwo",
        language: "en",
      });

      await request(app.getHttpServer())
        .patch("/api/user/bulk/roles")
        .set("Cookie", testCookies)
        .send({
          userIds: [firstUser.id, secondUser.id],
          roleSlugs: [SYSTEM_ROLE_SLUGS.CONTENT_CREATOR],
        })
        .expect(200);

      const firstResponse = await request(app.getHttpServer())
        .get(`/api/user?id=${firstUser.id}`)
        .set("Cookie", testCookies)
        .expect(200);

      const secondResponse = await request(app.getHttpServer())
        .get(`/api/user?id=${secondUser.id}`)
        .set("Cookie", testCookies)
        .expect(200);

      expect(firstResponse.body.data.roleSlugs).toContain(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
      expect(secondResponse.body.data.roleSlugs).toContain(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
    });

    it("should return 400 when no users are provided", async () => {
      const response = await request(app.getHttpServer())
        .patch("/api/user/bulk/roles")
        .set("Cookie", testCookies)
        .send({ userIds: [], roleSlugs: [SYSTEM_ROLE_SLUGS.ADMIN] })
        .expect(400);

      expect(response.body.message).toBe("adminUsersView.toast.noUserSelected");
    });

    it("should return 400 when attempting to update own role", async () => {
      const response = await request(app.getHttpServer())
        .patch("/api/user/bulk/roles")
        .set("Cookie", testCookies)
        .send({ userIds: [testUser.id], roleSlugs: [SYSTEM_ROLE_SLUGS.STUDENT] })
        .expect(400);

      expect(response.body.message).toBe("adminUsersView.toast.cannotUpdateOwnRole");
    });

    it("should return forbidden 403 for non-admins", async () => {
      const regularUser = await authService.register({
        email: "bulk-roles-regular@example.com",
        password: testPassword,
        firstName: "Regular",
        lastName: "User",
        language: "en",
      });

      const loginResponse = await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({
          email: regularUser.email,
          password: testPassword,
        })
        .expect(201);

      const cookies = loginResponse.headers["set-cookie"];

      await request(app.getHttpServer())
        .patch("/api/user/bulk/roles")
        .set("Cookie", cookies)
        .send({ userIds: [regularUser.id], roleSlugs: [SYSTEM_ROLE_SLUGS.ADMIN] })
        .expect(403);
    });
  });

  describe("Additional user endpoints coverage", () => {
    it("should return available roles", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/user/roles")
        .set("Cookie", testCookies)
        .expect(200);

      expect(response.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
            slug: SYSTEM_ROLE_SLUGS.ADMIN,
            isSystem: expect.any(Boolean),
          }),
          expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
            slug: SYSTEM_ROLE_SLUGS.STUDENT,
            isSystem: expect.any(Boolean),
          }),
        ]),
      );
    });

    it("should return 401 for PATCH /api/user/details when unauthenticated", async () => {
      await request(app.getHttpServer())
        .patch("/api/user/details")
        .send({ jobTitle: "Engineer" })
        .expect(401);
    });

    it("should return 401 for PATCH /api/user/profile when unauthenticated", async () => {
      await request(app.getHttpServer())
        .patch("/api/user/profile")
        .field("data", JSON.stringify({ firstName: "Anonymous" }))
        .expect(401);
    });

    it("should allow admin to update another user via PATCH /api/user/admin", async () => {
      const anotherUser = await authService.register({
        email: "admin-update-target@example.com",
        password: testPassword,
        firstName: "Target",
        lastName: "User",
        language: "en",
      });

      const response = await request(app.getHttpServer())
        .patch(`/api/user/admin?id=${anotherUser.id}`)
        .set("Cookie", testCookies)
        .send({ firstName: "UpdatedByAdmin" })
        .expect(200);

      expect(response.body.data.id).toBe(anotherUser.id);
      expect(response.body.data.firstName).toBe("UpdatedByAdmin");

      const [storedUser] = await db
        .select({ id: users.id, firstName: users.firstName })
        .from(users)
        .where(eq(users.id, anotherUser.id))
        .limit(1);

      expect(storedUser).toEqual({
        id: anotherUser.id,
        firstName: "UpdatedByAdmin",
      });
    });

    it("should archive users in bulk", async () => {
      const userToArchive = await authService.register({
        email: "archive-target@example.com",
        password: testPassword,
        firstName: "Archive",
        lastName: "Target",
        language: "en",
      });

      const response = await request(app.getHttpServer())
        .patch("/api/user/bulk/archive")
        .set("Cookie", testCookies)
        .send({ userIds: [userToArchive.id] })
        .expect(200);

      expect(response.body.data.archivedUsersCount).toBe(1);

      const [storedUser] = await db
        .select({ id: users.id, archived: users.archived })
        .from(users)
        .where(eq(users.id, userToArchive.id))
        .limit(1);

      expect(storedUser).toEqual({
        id: userToArchive.id,
        archived: true,
      });
    });

    it("should create user via POST /api/user", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/user")
        .set("Cookie", testCookies)
        .send({
          email: "created-through-endpoint@example.com",
          firstName: "Created",
          lastName: "User",
          roleSlugs: [SYSTEM_ROLE_SLUGS.STUDENT],
          language: "en",
        })
        .expect(201);

      expect(response.body.data.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(response.body.data.message).toBe("User created successfully");

      const [storedUser] = await db
        .select({ id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.id, response.body.data.id))
        .limit(1);

      expect(storedUser).toEqual({
        id: response.body.data.id,
        email: "created-through-endpoint@example.com",
        firstName: "Created",
        lastName: "User",
      });
    });

    it("should return 401 for POST /api/user/import when unauthenticated", async () => {
      await request(app.getHttpServer()).post("/api/user/import").expect(401);
    });

    it("should upsert current user details and persist values in DB", async () => {
      const payload = {
        description: "Backend engineer focused on reliability",
        contactEmail: "updated-profile@example.com",
        contactPhoneNumber: "+1-202-555-0114",
        jobTitle: "Software Engineer",
      };

      const response = await request(app.getHttpServer())
        .patch("/api/user/details")
        .set("Cookie", testCookies)
        .send(payload)
        .expect(200);

      expect(response.body.data).toEqual({
        id: testUser.id,
        message: "User details updated successfully",
      });

      const [storedDetails] = await db
        .select({
          userId: userDetails.userId,
          description: userDetails.description,
          contactEmail: userDetails.contactEmail,
          contactPhoneNumber: userDetails.contactPhoneNumber,
          jobTitle: userDetails.jobTitle,
        })
        .from(userDetails)
        .where(eq(userDetails.userId, testUser.id))
        .limit(1);

      expect(storedDetails).toEqual({
        userId: testUser.id,
        description: payload.description,
        contactEmail: payload.contactEmail,
        contactPhoneNumber: payload.contactPhoneNumber,
        jobTitle: payload.jobTitle,
      });
    });

    it("should reject self role changes for users without USER_MANAGE and keep roles unchanged", async () => {
      const regularUser = await authService.register({
        email: "self-role-restriction@example.com",
        password: testPassword,
        firstName: "Self",
        lastName: "Role",
        language: "en",
      });

      const regularUserLoginResponse = await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({
          email: regularUser.email,
          password: testPassword,
        })
        .expect(201);

      const regularUserCookies = regularUserLoginResponse.headers["set-cookie"];

      const beforeResponse = await request(app.getHttpServer())
        .get(`/api/user?id=${regularUser.id}`)
        .set("Cookie", testCookies)
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/user?id=${regularUser.id}`)
        .set("Cookie", regularUserCookies)
        .send({ roleSlugs: [SYSTEM_ROLE_SLUGS.ADMIN] })
        .expect(403);

      const afterResponse = await request(app.getHttpServer())
        .get(`/api/user?id=${regularUser.id}`)
        .set("Cookie", testCookies)
        .expect(200);

      expect(afterResponse.body.data.roleSlugs).toEqual(beforeResponse.body.data.roleSlugs);
    });

    it("should reject deleting non-student targets", async () => {
      const contentCreator = await userFactory
        .withCredentials({ password: "CreatorPassword123@@" })
        .withContentCreatorSettings(db)
        .create();

      const response = await request(app.getHttpServer())
        .delete("/api/user")
        .set("Cookie", testCookies)
        .send({ userIds: [contentCreator.id] })
        .expect(400);

      expect(response.body.message).toBe("You can only delete students");

      const [storedUser] = await db
        .select({ id: users.id, deletedAt: users.deletedAt, email: users.email })
        .from(users)
        .where(and(eq(users.id, contentCreator.id), isNull(users.deletedAt)))
        .limit(1);

      expect(storedUser).toEqual({
        id: contentCreator.id,
        deletedAt: null,
        email: contentCreator.email,
      });
    });

    it("should rollback bulk group assignment when payload contains unknown group id", async () => {
      const targetUser = await authService.register({
        email: "bulk-groups-target@example.com",
        password: testPassword,
        firstName: "Bulk",
        lastName: "Groups",
        language: "en",
      });

      const existingGroup = await groupService.createGroup({ name: "Existing Group" });
      await groupService.setUserGroups([existingGroup.id], targetUser.id);

      const response = await request(app.getHttpServer())
        .patch("/api/user/bulk/groups")
        .set("Cookie", testCookies)
        .send([{ userId: targetUser.id, groups: [existingGroup.id, crypto.randomUUID()] }])
        .expect(400);

      expect(response.body.message).toBe("One or more groups doesn't exist");

      const storedMembership = await db
        .select({ groupId: groupUsers.groupId })
        .from(groupUsers)
        .where(eq(groupUsers.userId, targetUser.id));

      expect(storedMembership).toEqual([{ groupId: existingGroup.id }]);
    });

    it("should report archived and already archived users separately in bulk archive", async () => {
      const activeUser = await authService.register({
        email: "bulk-archive-active@example.com",
        password: testPassword,
        firstName: "Archive",
        lastName: "Active",
        language: "en",
      });

      const alreadyArchivedUser = await userFactory
        .withCredentials({ password: "AlreadyArchived123@@" })
        .withUserSettings(db)
        .create({ archived: true });

      const response = await request(app.getHttpServer())
        .patch("/api/user/bulk/archive")
        .set("Cookie", testCookies)
        .send({ userIds: [activeUser.id, alreadyArchivedUser.id] })
        .expect(200);

      expect(response.body.data).toEqual({
        archivedUsersCount: 1,
        usersAlreadyArchivedCount: 1,
      });

      const [storedActive] = await db
        .select({ id: users.id, archived: users.archived })
        .from(users)
        .where(eq(users.id, activeUser.id))
        .limit(1);

      const [storedArchived] = await db
        .select({ id: users.id, archived: users.archived })
        .from(users)
        .where(eq(users.id, alreadyArchivedUser.id))
        .limit(1);

      expect(storedActive).toEqual({
        id: activeUser.id,
        archived: true,
      });
      expect(storedArchived).toEqual({
        id: alreadyArchivedUser.id,
        archived: true,
      });
    });

    it("should reject invalid role slugs in bulk role update and keep assignments unchanged", async () => {
      const roleTarget = await authService.register({
        email: "bulk-roles-invalid-target@example.com",
        password: testPassword,
        firstName: "Role",
        lastName: "Target",
        language: "en",
      });

      const beforeResponse = await request(app.getHttpServer())
        .get(`/api/user?id=${roleTarget.id}`)
        .set("Cookie", testCookies)
        .expect(200);

      const invalidRoleResponse = await request(app.getHttpServer())
        .patch("/api/user/bulk/roles")
        .set("Cookie", testCookies)
        .send({ userIds: [roleTarget.id], roleSlugs: ["NOT_A_REAL_ROLE"] })
        .expect(400);

      expect(invalidRoleResponse.body.message).toBe("adminUsersView.toast.invalidRole");

      const afterResponse = await request(app.getHttpServer())
        .get(`/api/user?id=${roleTarget.id}`)
        .set("Cookie", testCookies)
        .expect(200);

      expect(afterResponse.body.data.roleSlugs).toEqual(beforeResponse.body.data.roleSlugs);
    });

    it("should reject duplicate emails when creating a new user", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/user")
        .set("Cookie", testCookies)
        .send({
          email: testUser.email,
          firstName: "Duplicate",
          lastName: "User",
          roleSlugs: [SYSTEM_ROLE_SLUGS.STUDENT],
          language: "en",
        })
        .expect(409);

      expect(response.body.message).toBe("User already exists");

      const matchingUsers = await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(and(eq(users.email, testUser.email), isNull(users.deletedAt)));

      expect(matchingUsers).toEqual([{ id: testUser.id, email: testUser.email }]);
    });

    it("should return 400 for authenticated import request without file", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/user/import")
        .set("Cookie", testCookies)
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it("should filter user list by archived status and role", async () => {
      const archivedStudent = await userFactory
        .withCredentials({ password: "ArchivedStudent123@@" })
        .withUserSettings(db)
        .create({ archived: true });

      const archivedContentCreator = await userFactory
        .withCredentials({ password: "ArchivedCreator123@@" })
        .withContentCreatorSettings(db)
        .create({ archived: true });

      const response = await request(app.getHttpServer())
        .get(`/api/user/all?archived=true&roleSlug=${SYSTEM_ROLE_SLUGS.STUDENT}`)
        .set("Cookie", testCookies)
        .expect(200);

      const returnedIds = response.body.data.map((user: { id: string }) => user.id);

      expect(returnedIds).toContain(archivedStudent.id);
      expect(returnedIds).not.toContain(archivedContentCreator.id);

      const [storedArchivedStudent] = await db
        .select({ id: users.id, archived: users.archived })
        .from(users)
        .where(eq(users.id, archivedStudent.id))
        .limit(1);

      const [storedArchivedContentCreator] = await db
        .select({ id: users.id, archived: users.archived })
        .from(users)
        .where(eq(users.id, archivedContentCreator.id))
        .limit(1);

      expect(storedArchivedStudent).toEqual({ id: archivedStudent.id, archived: true });
      expect(storedArchivedContentCreator).toEqual({
        id: archivedContentCreator.id,
        archived: true,
      });
    });

    it("should reject mismatched password confirmation and keep old password valid", async () => {
      const mismatchResponse = await request(app.getHttpServer())
        .patch(`/api/user/change-password?id=${testUser.id}`)
        .set("Cookie", testCookies)
        .send({
          oldPassword: testPassword,
          newPassword: "NewPassword123@@",
          confirmPassword: "DifferentPassword123@@",
        })
        .expect(400);

      expect(mismatchResponse.body.message).toBe("changePasswordView.validation.passwordsDontMatch");

      const loginWithOldPassword = await request(app.getHttpServer()).post("/api/auth/login").send({
        email: testUser.email,
        password: testPassword,
      });

      expect(loginWithOldPassword.status).toBe(201);
      expect(loginWithOldPassword.headers["set-cookie"]).toBeDefined();
    });

    it("should reset onboarding status for current user", async () => {
      await request(app.getHttpServer())
        .patch("/api/user/onboarding-status/dashboard")
        .set("Cookie", testCookies)
        .expect(200);

      const response = await request(app.getHttpServer())
        .patch("/api/user/onboarding-status/reset")
        .set("Cookie", testCookies)
        .expect(200);

      expect(response.body.data.dashboard).toBe(false);
      expect(response.body.data.courses).toBe(false);
      expect(response.body.data.announcements).toBe(false);
      expect(response.body.data.profile).toBe(false);
      expect(response.body.data.settings).toBe(false);
      expect(response.body.data.providerInformation).toBe(false);

      const [storedOnboarding] = await db
        .select()
        .from(userOnboarding)
        .where(eq(userOnboarding.userId, testUser.id))
        .limit(1);

      expect(storedOnboarding?.dashboard).toBe(false);
      expect(storedOnboarding?.courses).toBe(false);
      expect(storedOnboarding?.announcements).toBe(false);
    });

    it("should mark onboarding page as completed", async () => {
      const response = await request(app.getHttpServer())
        .patch("/api/user/onboarding-status/dashboard")
        .set("Cookie", testCookies)
        .expect(200);

      expect(response.body.data.dashboard).toBe(true);

      const [storedOnboarding] = await db
        .select({ dashboard: userOnboarding.dashboard })
        .from(userOnboarding)
        .where(eq(userOnboarding.userId, testUser.id))
        .limit(1);

      expect(storedOnboarding?.dashboard).toBe(true);
    });
  });
});
