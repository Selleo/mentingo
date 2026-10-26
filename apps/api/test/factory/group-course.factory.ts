import { Factory } from "fishery";

import { groupCourses, groupManagerGroups } from "src/storage/schema";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { DatabasePg } from "src/common";

type GroupCourseTest = Omit<InferInsertModel<typeof groupCourses>, "tenantId">;
type GroupManagerGroupTest = Omit<InferInsertModel<typeof groupManagerGroups>, "tenantId">;

export const createGroupCourseFactory = (db: DatabasePg) =>
  Factory.define<GroupCourseTest, never, InferSelectModel<typeof groupCourses>>(({ onCreate }) => {
    onCreate(async (groupCourse) => {
      const [inserted] = await db.insert(groupCourses).values(groupCourse).returning();

      return inserted;
    });

    return {
      groupId: "",
      courseId: "",
      isMandatory: false,
    };
  });

export const createGroupManagerGroupFactory = (db: DatabasePg) =>
  Factory.define<GroupManagerGroupTest, never, InferSelectModel<typeof groupManagerGroups>>(
    ({ onCreate }) => {
      onCreate(async (groupManagerGroup) => {
        const [inserted] = await db
          .insert(groupManagerGroups)
          .values(groupManagerGroup)
          .returning();

        return inserted;
      });

      return {
        managerUserId: "",
        groupId: "",
      };
    },
  );
