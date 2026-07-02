#!/bin/sh
set -e

COMMAND="${1:-start}"

if [ $COMMAND = "start" ]; then
  echo "Running migrations..."
  npm run db:migrate
  echo "Running seeds..."
  npm run db:seed-prod
  echo "Starting server..."
  npm run start:prod
elif [ $COMMAND = "server" ]; then
  echo "Starting server..."
  npm run start:prod
elif [ $COMMAND = "migrate" ]; then
  echo "Running migrations..."
  npm run db:migrate
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
  echo "Usage: entrypoint.sh [start|server|migrate|seed|seed-prod|truncate-tables]"
  exit 1
fi
