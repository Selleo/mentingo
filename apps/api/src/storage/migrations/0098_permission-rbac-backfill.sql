WITH system_roles(slug, name) AS (
  VALUES
    ('student', 'Student'),
    ('content_creator', 'Content Creator'),
    ('admin', 'Admin')
)
INSERT INTO public.permission_roles (name, slug, description, is_system, tenant_id)
SELECT
  system_roles.name,
  system_roles.slug,
  system_roles.name || ' system role',
  TRUE,
  tenants.id
FROM public.tenants
CROSS JOIN system_roles
ON CONFLICT ("tenant_id", "slug") DO NOTHING;

WITH system_rule_sets(slug, name) AS (
  VALUES
    ('student-default', 'Student Default'),
    ('content_creator-default', 'Content Creator Default'),
    ('admin-default', 'Admin Default')
)
INSERT INTO public.permission_rule_sets (name, slug, description, is_system, tenant_id)
SELECT
  system_rule_sets.name,
  system_rule_sets.slug,
  system_rule_sets.name || ' permissions',
  TRUE,
  tenants.id
FROM public.tenants
CROSS JOIN system_rule_sets
ON CONFLICT ("tenant_id", "slug") DO NOTHING;

INSERT INTO public.permission_role_rule_sets (role_id, rule_set_id, tenant_id)
SELECT
  permission_roles.id,
  permission_rule_sets.id,
  permission_roles.tenant_id
FROM public.permission_roles
INNER JOIN public.permission_rule_sets
  ON permission_rule_sets.tenant_id = permission_roles.tenant_id
 AND permission_rule_sets.slug = permission_roles.slug || '-default'
ON CONFLICT ("role_id", "rule_set_id") DO NOTHING;

WITH role_permissions(role_slug, permission) AS (
  VALUES
    ('student', 'account.read_self'),
    ('student', 'account.update_self'),
    ('student', 'account.mfa'),
    ('student', 'user.read_self'),
    ('student', 'settings.read_self'),
    ('student', 'settings.update_self'),
    ('student', 'env.read_status'),
    ('student', 'category.read'),
    ('student', 'course.read_assigned'),
    ('student', 'course.read'),
    ('student', 'learning_progress.update'),
    ('student', 'certificate.read'),
    ('student', 'certificate.share'),
    ('student', 'certificate.render'),
    ('student', 'file.upload'),
    ('student', 'file.video'),
    ('student', 'ai.use'),
    ('student', 'announcement.read'),
    ('student', 'statistics.read_self'),
    ('student', 'billing.checkout'),
    ('student', 'scorm.read'),
    ('content_creator', 'account.read_self'),
    ('content_creator', 'account.update_self'),
    ('content_creator', 'account.mfa'),
    ('content_creator', 'user.read_self'),
    ('content_creator', 'settings.read_self'),
    ('content_creator', 'settings.update_self'),
    ('content_creator', 'env.read_status'),
    ('content_creator', 'category.read'),
    ('content_creator', 'course.read_assigned'),
    ('content_creator', 'course.read_manageable'),
    ('content_creator', 'course.read'),
    ('content_creator', 'course.create'),
    ('content_creator', 'course.update'),
    ('content_creator', 'course.statistics'),
    ('content_creator', 'learning_progress.update'),
    ('content_creator', 'certificate.read'),
    ('content_creator', 'certificate.share'),
    ('content_creator', 'certificate.render'),
    ('content_creator', 'file.upload'),
    ('content_creator', 'file.video'),
    ('content_creator', 'file.delete'),
    ('content_creator', 'ai.use'),
    ('content_creator', 'luma.manage'),
    ('content_creator', 'ingestion.manage'),
    ('content_creator', 'announcement.read'),
    ('content_creator', 'announcement.create'),
    ('content_creator', 'news.manage'),
    ('content_creator', 'article.manage'),
    ('content_creator', 'report.read'),
    ('content_creator', 'statistics.read_self'),
    ('content_creator', 'statistics.read'),
    ('content_creator', 'scorm.upload'),
    ('content_creator', 'scorm.read'),
    ('admin', 'account.access_public'),
    ('admin', 'account.read_self'),
    ('admin', 'account.update_self'),
    ('admin', 'account.mfa'),
    ('admin', 'user.read_self'),
    ('admin', 'user.manage'),
    ('admin', 'settings.read_public'),
    ('admin', 'settings.read_self'),
    ('admin', 'settings.update_self'),
    ('admin', 'settings.manage'),
    ('admin', 'env.read_public'),
    ('admin', 'env.read_status'),
    ('admin', 'env.manage'),
    ('admin', 'category.read'),
    ('admin', 'category.manage'),
    ('admin', 'group.read'),
    ('admin', 'group.manage'),
    ('admin', 'course.read_public'),
    ('admin', 'course.read_assigned'),
    ('admin', 'course.read_manageable'),
    ('admin', 'course.read'),
    ('admin', 'course.create'),
    ('admin', 'course.update'),
    ('admin', 'course.delete'),
    ('admin', 'course.enrollment'),
    ('admin', 'course.statistics'),
    ('admin', 'course.ownership'),
    ('admin', 'course.export'),
    ('admin', 'learning_progress.update'),
    ('admin', 'certificate.read'),
    ('admin', 'certificate.share'),
    ('admin', 'certificate.render'),
    ('admin', 'file.upload'),
    ('admin', 'file.video'),
    ('admin', 'file.delete'),
    ('admin', 'file.read_public'),
    ('admin', 'ai.use'),
    ('admin', 'luma.manage'),
    ('admin', 'ingestion.manage'),
    ('admin', 'announcement.read'),
    ('admin', 'announcement.create'),
    ('admin', 'news.read_public'),
    ('admin', 'news.manage'),
    ('admin', 'article.read_public'),
    ('admin', 'article.manage'),
    ('admin', 'qa.read_public'),
    ('admin', 'qa.manage'),
    ('admin', 'report.read'),
    ('admin', 'statistics.read_self'),
    ('admin', 'statistics.read'),
    ('admin', 'billing.checkout'),
    ('admin', 'billing.manage'),
    ('admin', 'integration_key.manage'),
    ('admin', 'integration_api.use'),
    ('admin', 'tenant.manage'),
    ('admin', 'scorm.upload'),
    ('admin', 'scorm.read'),
    ('admin', 'analytics.read'),
    ('admin', 'health.read')
)
INSERT INTO public.permission_rule_set_permissions (rule_set_id, permission, tenant_id)
SELECT
  permission_rule_sets.id,
  role_permissions.permission,
  permission_rule_sets.tenant_id
FROM public.permission_rule_sets
INNER JOIN role_permissions
  ON permission_rule_sets.slug = role_permissions.role_slug || '-default'
ON CONFLICT ("rule_set_id", "permission") DO NOTHING;

INSERT INTO public.permission_user_roles (user_id, role_id, tenant_id)
SELECT
  users.id,
  permission_roles.id,
  users.tenant_id
FROM public.users
INNER JOIN public.permission_roles
  ON permission_roles.tenant_id = users.tenant_id
 AND permission_roles.slug = users.role
ON CONFLICT ("user_id", "role_id") DO NOTHING;

DO $$
BEGIN
  ALTER TABLE public.permission_roles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.permission_rule_sets ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.permission_role_rule_sets ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.permission_rule_set_permissions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.permission_user_roles ENABLE ROW LEVEL SECURITY;

  BEGIN
    CREATE POLICY permission_roles_tenant_isolation
      ON public.permission_roles
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    CREATE POLICY permission_rule_sets_tenant_isolation
      ON public.permission_rule_sets
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    CREATE POLICY permission_role_rule_sets_tenant_isolation
      ON public.permission_role_rule_sets
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    CREATE POLICY permission_rule_set_permissions_tenant_isolation
      ON public.permission_rule_set_permissions
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    CREATE POLICY permission_user_roles_tenant_isolation
      ON public.permission_user_roles
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END
$$;
