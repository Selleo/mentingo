-- Preserve ciphertext and encryption metadata by changing only secret_name.
UPDATE "secrets"
SET "secret_name" = 'BUNNY_STREAM_READ_ONLY_API_KEY'
WHERE "secret_name" = 'BUNNY_STREAM_SIGNING_KEY';
