#!/bin/sh
set -eu

: "${S3_ENDPOINT:?S3_ENDPOINT is required}"
: "${S3_BUCKET_NAME:?S3_BUCKET_NAME is required}"

export AWS_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID:?S3_ACCESS_KEY_ID is required}"
export AWS_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY:?S3_SECRET_ACCESS_KEY is required}"
export AWS_DEFAULT_REGION="${S3_REGION:-us-east-1}"

if aws --endpoint-url "$S3_ENDPOINT" s3api head-bucket --bucket "$S3_BUCKET_NAME" >/dev/null 2>&1; then
  echo "Bucket '$S3_BUCKET_NAME' already exists"
else
  aws --endpoint-url "$S3_ENDPOINT" s3api create-bucket --bucket "$S3_BUCKET_NAME"
  echo "Bucket '$S3_BUCKET_NAME' created"
fi

if [ "${S3_CONFIGURE_CORS:-false}" = "true" ]; then
  aws --endpoint-url "$S3_ENDPOINT" s3api put-bucket-cors \
    --bucket "$S3_BUCKET_NAME" \
    --cors-configuration '{"CORSRules":[{"AllowedOrigins":["*"],"AllowedMethods":["GET","PUT","POST","DELETE"],"AllowedHeaders":["*"]}]}' || true
fi
