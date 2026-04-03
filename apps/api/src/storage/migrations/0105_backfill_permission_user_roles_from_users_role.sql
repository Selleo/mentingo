DO $$
DECLARE
  tenant_record RECORD;
  role_config RECORD;
  v_role_id uuid;
  v_rule_set_id uuid;
BEGIN
  FOR tenant_record IN
    SELECT id
    FROM tenants
  LOOP
    FOR role_config IN
      SELECT *
      FROM (
        VALUES
          (
            'student'::text,
            'Student'::text,
            'student-default'::text,
            'Student Default'::text,
            ARRAY[
              'account.read_self',
              'account.update_self',
              'user.read_self',
              'settings.read_self',
              'settings.update_self',
              'env.read_public',
              'category.read',
              'course.read_assigned',
              'course.read',
              'learning_progress.update',
              'certificate.read',
              'certificate.share',
              'certificate.render',
              'file.upload',
              'ai.use',
              'announcement.read',
              'statistics.read_self',
              'billing.checkout',
              'news.read_public',
              'article.read_public',
              'qa.read_public'
            ]::text[]
          ),
          (
            'content_creator'::text,
            'Content Creator'::text,
            'content_creator-default'::text,
            'Content Creator Default'::text,
            ARRAY[
              'account.read_self',
              'account.update_self',
              'user.read_self',
              'settings.read_self',
              'settings.update_self',
              'env.read_public',
              'category.read',
              'course.read_assigned',
              'course.read_manageable',
              'course.read',
              'learning_progress.update',
              'learning_mode.use',
              'course.create',
              'course.update_own',
              'course.statistics',
              'certificate.read',
              'certificate.share',
              'certificate.render',
              'file.upload',
              'file.delete',
              'ai.use',
              'course.ai_generation',
              'announcement.read',
              'announcement.create',
              'news.manage_own',
              'news.read_public',
              'article.manage_own',
              'article.read_public',
              'qa.manage_own',
              'qa.read_public',
              'report.read',
              'statistics.read_self',
              'statistics.read',
              'billing.checkout'
            ]::text[]
          ),
          (
            'admin'::text,
            'Admin'::text,
            'admin-default'::text,
            'Admin Default'::text,
            ARRAY[
              'account.read_self',
              'account.update_self',
              'user.read_self',
              'settings.read_self',
              'settings.update_self',
              'settings.manage',
              'env.read_public',
              'env.manage',
              'category.read',
              'category.manage',
              'group.read',
              'group.manage',
              'course.read_assigned',
              'course.read_manageable',
              'course.read',
              'learning_mode.use',
              'course.create',
              'course.update',
              'course.delete',
              'course.statistics',
              'course.enrollment',
              'certificate.read',
              'certificate.share',
              'certificate.render',
              'file.upload',
              'file.delete',
              'ai.use',
              'course.ai_generation',
              'announcement.read',
              'announcement.create',
              'news.manage',
              'news.read_public',
              'article.manage',
              'article.read_public',
              'qa.manage',
              'qa.read_public',
              'report.read',
              'statistics.read_self',
              'statistics.read',
              'billing.checkout',
              'billing.manage',
              'user.manage',
              'integration_key.manage',
              'integration_api.use',
              'tenant.manage',
              'course.export'
            ]::text[]
          )
      ) AS rc(role_slug, role_name, rule_set_slug, rule_set_name, permissions)
    LOOP
      INSERT INTO permission_roles (tenant_id, name, slug, is_system)
      VALUES (tenant_record.id, role_config.role_name, role_config.role_slug, true)
      ON CONFLICT (tenant_id, slug)
        DO UPDATE
        SET
          name = excluded.name,
          is_system = true,
          updated_at = NOW()
      RETURNING id INTO v_role_id;

      INSERT INTO permission_rule_sets (tenant_id, name, slug, is_system)
      VALUES (tenant_record.id, role_config.rule_set_name, role_config.rule_set_slug, true)
      ON CONFLICT (tenant_id, slug)
        DO UPDATE
        SET
          name = excluded.name,
          is_system = true,
          updated_at = NOW()
      RETURNING id INTO v_rule_set_id;

      INSERT INTO permission_role_rule_sets (tenant_id, role_id, rule_set_id)
      VALUES (tenant_record.id, v_role_id, v_rule_set_id)
      ON CONFLICT (role_id, rule_set_id) DO NOTHING;

      DELETE FROM permission_rule_set_permissions
      WHERE rule_set_id = v_rule_set_id;

      IF array_length(role_config.permissions, 1) > 0 THEN
        INSERT INTO permission_rule_set_permissions (tenant_id, rule_set_id, permission)
        SELECT tenant_record.id, v_rule_set_id, permission_value
        FROM unnest(role_config.permissions) AS permission_value;
      END IF;
    END LOOP;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = 'users'
        AND c.column_name = 'role'
    ) THEN
      INSERT INTO permission_user_roles (tenant_id, user_id, role_id)
      SELECT
        u.tenant_id,
        u.id,
        pr.id
      FROM users u
      INNER JOIN permission_roles pr
        ON pr.tenant_id = u.tenant_id
       AND pr.slug = lower(u.role)
      WHERE u.tenant_id = tenant_record.id
        AND lower(u.role) IN ('admin', 'content_creator', 'student')
        AND NOT EXISTS (
          SELECT 1
          FROM permission_user_roles pur
          WHERE pur.tenant_id = u.tenant_id
            AND pur.user_id = u.id
        )
      ON CONFLICT (user_id, role_id) DO NOTHING;
    END IF;
  END LOOP;
END $$;
