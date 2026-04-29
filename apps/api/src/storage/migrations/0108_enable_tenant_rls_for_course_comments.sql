-- Enable RLS for course_comments

DO $$
BEGIN
  ALTER TABLE public.course_comments ENABLE ROW LEVEL SECURITY;

  BEGIN
    CREATE POLICY course_comments_tenant_isolation
      ON public.course_comments
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END
$$;

