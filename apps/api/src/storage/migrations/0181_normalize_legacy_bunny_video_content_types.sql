-- Custom SQL migration file, put you code below! --

UPDATE public.resources
SET content_type = 'video/mp4'
WHERE reference LIKE 'bunny-%'
  AND content_type = 'mp4';
