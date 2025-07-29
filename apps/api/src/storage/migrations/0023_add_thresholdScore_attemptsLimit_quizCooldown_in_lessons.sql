BEGIN;

ALTER TABLE lessons
  ADD COLUMN threshold_score INTEGER NULL,
  ADD COLUMN attempts_limit INTEGER NULL,
  ADD COLUMN quiz_cooldown_in_hours INTEGER NULL;

UPDATE lessons
SET
  threshold_score = CASE WHEN type = 'quiz' THEN 0 ELSE NULL END,
  attempts_limit = NULL,
  quiz_cooldown_in_hours = NULL;

ALTER TABLE lessons
  ADD CONSTRAINT quiz_threshold_check CHECK (
    (type = 'quiz' AND threshold_score IS NOT NULL) OR
    (type <> 'quiz' AND threshold_score IS NULL)
  );

COMMIT;	
