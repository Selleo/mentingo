-- Custom SQL migration file, put your code below! --

UPDATE "certificates" AS "certificate"
SET "issued_at" = COALESCE(
  (
    SELECT "student_courses"."completed_at"
    FROM "student_courses"
    WHERE "student_courses"."student_id" = "certificate"."user_id"
      AND "student_courses"."course_id" = "certificate"."course_id"
      AND "student_courses"."tenant_id" = "certificate"."tenant_id"
    LIMIT 1
  ),
  "certificate"."created_at"
);
