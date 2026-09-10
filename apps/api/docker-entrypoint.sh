#!/bin/sh
set -e

# Fuehrt offene Datenbank-Migrationen aus, bevor der Server startet.
# Deaktivierbar ueber RUN_MIGRATIONS=false (z. B. wenn ein separater
# Migrations-Job genutzt wird). node-pg-migrate ist idempotent und
# protokolliert bereits angewendete Migrationen in der Tabelle pgmigrations.
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[entrypoint] Migrationen werden ausgefuehrt ..."
  node_modules/.bin/node-pg-migrate up \
    --migrations-dir apps/api/migrations \
    --migration-file-language sql \
    --database-url-var DATABASE_URL
  echo "[entrypoint] Migrationen abgeschlossen."
fi

exec "$@"
