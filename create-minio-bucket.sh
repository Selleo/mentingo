#!/bin/sh
set -e

echo "🪣 Creating bucket: ${S3_BUCKET_NAME}"
mc alias set local http://minio:9000 ${S3_ACCESS_KEY_ID} ${S3_SECRET_ACCESS_KEY}

if mc ls local/${S3_BUCKET_NAME} > /dev/null 2>&1; then
  echo "ℹ️  Bucket '${S3_BUCKET_NAME}' already exists"
else
  mc mb local/${S3_BUCKET_NAME}
  echo "✅ Bucket '${S3_BUCKET_NAME}' created successfully"
fi

echo "✅ MinIO setup complete"
