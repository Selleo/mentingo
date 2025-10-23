-- Custom SQL migration file, put you code below! --
UPDATE settings
SET
    settings = jsonb_set(
            COALESCE(settings, '{}'::jsonb),
            '{userEmailTriggers}',
            '{"userInvite": false, "userFirstLogin": false, "userCourseAssignment": false, "userShortInactivity": false, "userLongInactivity": false, "userChapterFinished": false, "userCourseFinished": false}'::jsonb,
            true
               )
WHERE
    user_id IS NULL;