#!/bin/sh
set -e

# Ensure upload subdirectories exist and fix ownership
mkdir -p /app/uploads/photos /app/uploads/cvs
chown -R node:node /app/uploads

# Run migrations then start app, both as non-root user
su-exec node node server/db/migrate.js
exec su-exec node "$@"
