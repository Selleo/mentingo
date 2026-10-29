#!/bin/sh
set -e

COMMAND="${1:-server}"

if [ $COMMAND = "server" ]; then
  echo "Starting server..."
  npm run start:prod
elif [ $COMMAND = "migrate" ]; then
  echo "Running migrations..."
  npm run db:migrate:prod
elif [ $COMMAND = "seed" ]; then
  echo "Running seeds..."
  npm run db:seed-staging
elif [ $COMMAND = "seed-prod" ]; then
  echo "Running seeds..."
  npm run db:seed-prod
elif [ $COMMAND = "truncate-tables" ]; then
  echo "Truncating tables..."
  npm run db:truncate-tables
else
  echo "Usage: entrypoint.sh [server|migrate|seed-staging|seed-prod|truncate-tables]"
  exit 1
fi
