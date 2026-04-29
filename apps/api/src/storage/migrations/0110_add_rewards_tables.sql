CREATE TABLE IF NOT EXISTS "reward_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"action_type" varchar(100) NOT NULL,
	"points" integer NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	CONSTRAINT "reward_rules_tenant_id_action_type_unique" UNIQUE("tenant_id","action_type")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reward_point_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"user_id" uuid NOT NULL,
	"action_type" varchar(100) NOT NULL,
	"source_entity_type" varchar(100) NOT NULL,
	"source_entity_id" uuid NOT NULL,
	"points" integer NOT NULL,
	"rule_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"awarded_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	CONSTRAINT "reward_point_ledger_tenant_user_action_source_unique" UNIQUE("tenant_id","user_id","action_type","source_entity_type","source_entity_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_reward_totals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"user_id" uuid NOT NULL,
	"total_points" integer DEFAULT 0 NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	CONSTRAINT "user_reward_totals_tenant_id_user_id_unique" UNIQUE("tenant_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reward_achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"title" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"description" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"point_threshold" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_reward_achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"user_id" uuid NOT NULL,
	"achievement_id" uuid NOT NULL,
	"earned_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"point_total_at_earn" integer NOT NULL,
	"threshold_at_earn" integer NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL,
	CONSTRAINT "user_reward_achievements_tenant_user_achievement_unique" UNIQUE("tenant_id","user_id","achievement_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reward_rules" ADD CONSTRAINT "reward_rules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reward_point_ledger" ADD CONSTRAINT "reward_point_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reward_point_ledger" ADD CONSTRAINT "reward_point_ledger_rule_id_reward_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."reward_rules"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reward_point_ledger" ADD CONSTRAINT "reward_point_ledger_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_reward_totals" ADD CONSTRAINT "user_reward_totals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_reward_totals" ADD CONSTRAINT "user_reward_totals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reward_achievements" ADD CONSTRAINT "reward_achievements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_reward_achievements" ADD CONSTRAINT "user_reward_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_reward_achievements" ADD CONSTRAINT "user_reward_achievements_achievement_id_reward_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."reward_achievements"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_reward_achievements" ADD CONSTRAINT "user_reward_achievements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reward_rules_tenant_id_idx" ON "reward_rules" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reward_point_ledger_tenant_id_idx" ON "reward_point_ledger" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reward_point_ledger_user_idx" ON "reward_point_ledger" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reward_point_ledger_source_idx" ON "reward_point_ledger" USING btree ("source_entity_type","source_entity_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_reward_totals_tenant_id_idx" ON "user_reward_totals" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_reward_totals_points_idx" ON "user_reward_totals" USING btree ("total_points");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reward_achievements_tenant_id_idx" ON "reward_achievements" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reward_achievements_threshold_idx" ON "reward_achievements" USING btree ("point_threshold");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_reward_achievements_tenant_id_idx" ON "user_reward_achievements" USING btree ("tenant_id");
--> statement-breakpoint
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT table_schema, table_name
    FROM information_schema.columns
    WHERE column_name = 'tenant_id'
      AND table_schema = 'public'
      AND table_name IN ('reward_rules', 'reward_point_ledger', 'user_reward_totals', 'reward_achievements', 'user_reward_achievements')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', r.table_schema, r.table_name);
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I USING (tenant_id = current_setting(''app.tenant_id'', true)::uuid) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true)::uuid)',
      concat(r.table_name, '_tenant_isolation'),
      r.table_schema,
      r.table_name
    );
  END LOOP;
END
$$;
--> statement-breakpoint
INSERT INTO reward_rules (tenant_id, action_type, points, enabled)
SELECT tenants.id, rules.action_type, rules.points, true
FROM tenants
CROSS JOIN (
  VALUES
    ('chapter_completed', 10),
    ('ai_conversation_passed', 30),
    ('course_completed', 50)
) AS rules(action_type, points)
ON CONFLICT (tenant_id, action_type) DO NOTHING;
--> statement-breakpoint
INSERT INTO permission_rule_set_permissions (tenant_id, rule_set_id, permission)
SELECT prs.tenant_id, prs.id, permission_value
FROM permission_rule_sets prs
CROSS JOIN (
  VALUES
    ('rewards.read'),
    ('rewards.manage')
) AS permissions(permission_value)
WHERE prs.slug = 'admin-default'
ON CONFLICT (rule_set_id, permission) DO NOTHING;
--> statement-breakpoint
INSERT INTO permission_rule_set_permissions (tenant_id, rule_set_id, permission)
SELECT prs.tenant_id, prs.id, 'rewards.read'
FROM permission_rule_sets prs
WHERE prs.slug IN ('student-default', 'content_creator-default')
ON CONFLICT (rule_set_id, permission) DO NOTHING;
