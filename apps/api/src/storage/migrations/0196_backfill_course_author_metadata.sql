-- Custom SQL migration file, put you code below! --
UPDATE courses AS target_course
SET author_metadata = jsonb_build_object(
  'authorId', source_author.id,
  'firstName', source_author.first_name,
  'lastName', source_author.last_name,
  'jobTitle', source_details.job_title,
  'description', source_details.description,
  'profilePictureReference', source_author.avatar_reference
)
FROM master_course_exports AS export_link
JOIN courses AS source_course ON source_course.id = export_link.source_course_id
JOIN users AS source_author ON source_author.id = source_course.author_id
LEFT JOIN user_details AS source_details ON source_details.user_id = source_author.id
WHERE target_course.id = export_link.target_course_id
  AND (target_course.author_metadata IS NULL OR target_course.author_metadata = 'null'::jsonb)
  AND source_course.author_id IS NOT NULL;

UPDATE courses AS course
SET author_metadata = jsonb_build_object(
  'authorId', author.id,
  'firstName', author.first_name,
  'lastName', author.last_name,
  'jobTitle', details.job_title,
  'description', details.description,
  'profilePictureReference', author.avatar_reference
)
FROM users AS author
LEFT JOIN user_details AS details ON details.user_id = author.id
WHERE (course.author_metadata IS NULL OR course.author_metadata = 'null'::jsonb)
  AND course.author_id = author.id;
