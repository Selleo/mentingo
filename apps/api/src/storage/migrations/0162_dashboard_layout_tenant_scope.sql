ALTER TABLE "dashboard_layout_widgets" ALTER COLUMN "created_at" SET DATA TYPE timestamp(3) with time zone;--> statement-breakpoint
ALTER TABLE "dashboard_layout_widgets" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE "dashboard_layout_widgets" ALTER COLUMN "updated_at" SET DATA TYPE timestamp(3) with time zone;--> statement-breakpoint
ALTER TABLE "dashboard_layout_widgets" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE "dashboard_layouts" ALTER COLUMN "tenant_id" SET DEFAULT current_setting('app.tenant_id', true)::uuid;--> statement-breakpoint
ALTER TABLE "dashboard_layouts" ALTER COLUMN "created_at" SET DATA TYPE timestamp(3) with time zone;--> statement-breakpoint
ALTER TABLE "dashboard_layouts" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE "dashboard_layouts" ALTER COLUMN "updated_at" SET DATA TYPE timestamp(3) with time zone;--> statement-breakpoint
ALTER TABLE "dashboard_layouts" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE "dashboard_layout_widgets" ADD COLUMN "tenant_id" uuid DEFAULT current_setting('app.tenant_id', true)::uuid NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dashboard_layout_widgets" ADD CONSTRAINT "dashboard_layout_widgets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dashboard_layouts" ADD CONSTRAINT "dashboard_layouts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dashboard_layout_widgets_tenant_id_idx" ON "dashboard_layout_widgets" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dashboard_layouts_tenant_id_idx" ON "dashboard_layouts" USING btree ("tenant_id");