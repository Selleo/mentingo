-- Custom SQL migration file, put you code below! --

UPDATE courses
SET settings = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          COALESCE(settings, '{}'::jsonb),
          '{lessonSequenceEnabled}',
          COALESCE(settings->'lessonSequenceEnabled', 'false'::jsonb),
          true
        ),
        '{quizFeedbackEnabled}',
        COALESCE(settings->'quizFeedbackEnabled', 'true'::jsonb),
        true
      ),
      '{certificateSignature}',
      COALESCE(settings->'certificateSignature', 'null'::jsonb),
      true
    ),
    '{certificateFontColor}',
    COALESCE(settings->'certificateFontColor', 'null'::jsonb),
    true
  )
WHERE settings IS NULL
   OR NOT (settings ? 'lessonSequenceEnabled')
   OR NOT (settings ? 'quizFeedbackEnabled')
   OR NOT (settings ? 'certificateSignature')
   OR NOT (settings ? 'certificateFontColor');