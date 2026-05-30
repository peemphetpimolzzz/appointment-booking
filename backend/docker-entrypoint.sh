#!/bin/sh
set -e

# Apply migrations (creates the schema + the btree_gist EXCLUDE constraint),
# then run the idempotent seed, then start the API.
echo "[entrypoint] applying migrations"
npx prisma migrate deploy

echo "[entrypoint] seeding"
node dist/seed.js

echo "[entrypoint] starting API"
exec node dist/index.js
