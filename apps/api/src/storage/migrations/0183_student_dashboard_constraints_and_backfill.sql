DO $$ BEGIN
	ALTER TABLE "ai_judge_configurations"
		ADD CONSTRAINT "ai_judge_configurations_exactly_one_source_check"
		CHECK (("ai_mentor_lesson_id" IS NOT NULL) <> ("practice_session_id" IS NOT NULL));
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "ai_mentor_threads"
		ADD CONSTRAINT "ai_mentor_threads_exactly_one_source_check"
		CHECK (("ai_mentor_lesson_id" IS NOT NULL) <> ("practice_session_id" IS NOT NULL));
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "ai_mentor_practice_sessions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "ai_mentor_practice_sessions_tenant_isolation"
	ON "ai_mentor_practice_sessions";
--> statement-breakpoint
CREATE POLICY "ai_mentor_practice_sessions_tenant_isolation"
	ON "ai_mentor_practice_sessions"
	USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
	WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
UPDATE "settings" AS target
SET "settings" = jsonb_set(
	target."settings",
	'{dashboard,widgets}',
	(
		SELECT jsonb_agg(
			jsonb_set(
				widget.value,
				'{id}',
				to_jsonb(
					CASE widget.value->>'id'
						WHEN 's_placeholder_1' THEN 's_continue_learning'
						WHEN 's_placeholder_2' THEN 's_required_course'
						WHEN 's_placeholder_3' THEN 's_course_completion'
						ELSE widget.value->>'id'
					END
				),
				false
			)
			ORDER BY widget.ordinality
		)
		FROM jsonb_array_elements(target."settings"->'dashboard'->'widgets')
			WITH ORDINALITY AS widget(value, ordinality)
	),
	false
)
WHERE jsonb_typeof(target."settings"->'dashboard'->'widgets') = 'array'
	AND EXISTS (
		SELECT 1
		FROM jsonb_array_elements(target."settings"->'dashboard'->'widgets') AS widget(value)
		WHERE widget.value->>'id' IN (
			's_placeholder_1',
			's_placeholder_2',
			's_placeholder_3'
		)
	);
--> statement-breakpoint
UPDATE "settings" AS target
SET "settings" = jsonb_set(
	target."settings",
	'{dashboard,widgets}',
	(target."settings"->'dashboard'->'widgets') || jsonb_build_array(
		jsonb_build_object(
			'id', 's_event_calendar',
			'order', jsonb_array_length(target."settings"->'dashboard'->'widgets'),
			'width', 2
		)
	),
	false
)
WHERE target."user_id" IS NOT NULL
	AND jsonb_typeof(target."settings"->'dashboard'->'widgets') = 'array'
	AND NOT EXISTS (
		SELECT 1
		FROM jsonb_array_elements(target."settings"->'dashboard'->'widgets') AS widget(value)
		WHERE widget.value->>'id' = 's_event_calendar'
	);
