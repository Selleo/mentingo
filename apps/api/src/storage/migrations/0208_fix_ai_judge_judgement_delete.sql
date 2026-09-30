ALTER TABLE "ai_mentor_judgements" DROP CONSTRAINT "ai_mentor_judgements_configuration_id_ai_judge_configurations_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai_mentor_judgements" ADD CONSTRAINT "ai_mentor_judgements_configuration_id_ai_judge_configurations_id_fk" FOREIGN KEY ("configuration_id") REFERENCES "public"."ai_judge_configurations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
