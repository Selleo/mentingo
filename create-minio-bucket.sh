#!/bin/sh
set -eu

if [ -n "${MINIO_HOST:-}" ]; then
  HOST="http://${MINIO_HOST}:9000"
else
  HOST="http://minio:9000"
fi

echo "🪣 Creating bucket: ${S3_BUCKET_NAME}"
echo "🔗 Using MinIO host: ${HOST}"

mc alias set local ${HOST} ${S3_ACCESS_KEY_ID} ${S3_SECRET_ACCESS_KEY}

if mc ls local/${S3_BUCKET_NAME} > /dev/null 2>&1; then
  echo "ℹ️  Bucket '${S3_BUCKET_NAME}' already exists"
else
  mc mb local/${S3_BUCKET_NAME}
  echo "✅ Bucket '${S3_BUCKET_NAME}' created successfully"
fi

echo "✅ MinIO setup complete"
