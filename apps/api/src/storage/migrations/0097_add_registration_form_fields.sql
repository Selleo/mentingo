CREATE TABLE IF NOT EXISTS "form_field_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"form_field_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"value" boolean NOT NULL,
	"label_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"answered_language" text DEFAULT 'en' NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "form_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"form_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"label" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"base_language" text DEFAULT 'en' NOT NULL,
	"available_locales" text[] DEFAULT ARRAY['en']::text[] NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"type" varchar(50) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "courses" ALTER COLUMN "settings" SET DEFAULT '{"lessonSequenceEnabled":false,"quizFeedbackEnabled":true,"certificateSignature":null,"certificateFontColor":null}'::jsonb;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "form_field_answers" ADD CONSTRAINT "form_field_answers_form_field_id_form_fields_id_fk" FOREIGN KEY ("form_field_id") REFERENCES "public"."form_fields"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "form_field_answers" ADD CONSTRAINT "form_field_answers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "form_field_answers" ADD CONSTRAINT "form_field_answers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "form_fields" ADD CONSTRAINT "form_fields_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "form_fields" ADD CONSTRAINT "form_fields_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "forms" ADD CONSTRAINT "forms_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "form_field_answers_tenant_id_idx" ON "form_field_answers" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "form_field_answers_user_id_form_field_id_unique" ON "form_field_answers" USING btree ("user_id","form_field_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "form_field_answers_user_id_idx" ON "form_field_answers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "form_fields_tenant_id_idx" ON "form_fields" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "form_fields_form_id_display_order_idx" ON "form_fields" USING btree ("form_id","display_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forms_tenant_id_idx" ON "forms" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "forms_tenant_id_type_unique_idx" ON "forms" USING btree ("tenant_id","type");