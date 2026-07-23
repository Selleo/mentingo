-- Custom SQL migration file, put you code below! --
ALTER TABLE "microsoft_calendar_outbound_events" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "microsoft_calendar_outbound_events_tenant_isolation"
ON "microsoft_calendar_outbound_events"
USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
