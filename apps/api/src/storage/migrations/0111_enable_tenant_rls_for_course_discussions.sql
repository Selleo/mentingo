ALTER TABLE course_discussion_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY course_discussion_threads_tenant_isolation
  ON course_discussion_threads
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE course_discussion_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY course_discussion_comments_tenant_isolation
  ON course_discussion_comments
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
