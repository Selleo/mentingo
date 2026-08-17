-- Custom SQL migration file, put you code below! --

ALTER TABLE "todo_tasks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "todo_tasks_tenant_isolation" ON "todo_tasks";
--> statement-breakpoint
CREATE POLICY "todo_tasks_tenant_isolation"
  ON "todo_tasks"
  USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
