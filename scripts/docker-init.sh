#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
umask 077
if [ -e .local/docker.env ]; then
  echo 'Ya existe .local/docker.env. Se conservaron las claves y la carpeta de datos.'
  exit 0
fi
command -v docker >/dev/null 2>&1 || { echo 'Instala y abre Docker Desktop primero.' >&2; exit 1; }
docker info >/dev/null 2>&1 || { echo 'Abre Docker Desktop y espera a que el motor esté listo.' >&2; exit 1; }
mkdir -p .local
task_data_dir="${FUTAPP_DATA_DIR:-$HOME/FutAppData/runtime}"
case "$task_data_dir" in /*) ;; *) echo 'FUTAPP_DATA_DIR debe ser una ruta absoluta.' >&2; exit 1;; esac
case "$task_data_dir" in *"'"*|*'"'*) echo 'Usa una ruta sin comillas.' >&2; exit 1;; esac
if [ "$(printf '%s' "$task_data_dir" | tr -d '\r\n')" != "$task_data_dir" ]; then echo 'Ruta inválida.' >&2; exit 1; fi
mkdir -p "$task_data_dir"
task_env_file=$(mktemp .local/docker-env.XXXXXX)
trap 'rm -f "$task_env_file"' EXIT HUP INT TERM
docker run --rm docker.io/library/node:24-bookworm-slim node -e 'const c=require("node:crypto"); console.log("JWT_SECRET="+c.randomBytes(48).toString("base64url")); console.log("ADMIN_PASSWORD="+c.randomBytes(24).toString("base64url"));' > "$task_env_file"
printf "FUTAPP_DATA_DIR='%s'\nFUTAPP_UID=%s\nFUTAPP_GID=%s\nFUTAPP_PORT=8080\nADMIN_EMAIL=admin@futapp.local\nPUBLIC_APP_URL=http://localhost:8080\n" "$task_data_dir" "$(id -u)" "$(id -g)" >> "$task_env_file"
# Exclusive creation: a concurrent initializer cannot replace existing credentials.
ln "$task_env_file" .local/docker.env
echo 'Configuración privada creada en .local/docker.env; no se imprimieron las claves.'
echo 'Siguiente: docker compose --env-file .local/docker.env up -d --build app'
