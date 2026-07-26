#!/bin/sh
# minio-bucket-init.sh
# Cria o bucket local no MinIO se ainda nao existir.
# Idempotente: pode ser executado multiplas vezes sem problema.
# Depende do container therapy-flow-minio estar rodando.

set -eu

BUCKET="${LOCAL_B2_BUCKET_NAME:-pluri-health-local}"
ALIAS="local"
MINIO_URL="http://localhost:9000"
MINIO_USER="devminio"
MINIO_PASS="devminio123"
CONTAINER="therapy-flow-minio"

if ! docker inspect "$CONTAINER" > /dev/null 2>&1; then
  echo "Container $CONTAINER nao esta rodando. Inicie o storage primeiro." >&2
  exit 1
fi

# Aguarda o MinIO estar pronto (ate 20s)
retries=10
while [ "$retries" -gt 0 ]; do
  if docker exec "$CONTAINER" sh -c "mc alias set $ALIAS $MINIO_URL $MINIO_USER $MINIO_PASS --quiet > /dev/null 2>&1"; then
    break
  fi
  retries=$((retries - 1))
  sleep 2
done

if [ "$retries" -eq 0 ]; then
  echo "MinIO nao respondeu a tempo. Verifique os logs com 'docker logs $CONTAINER'." >&2
  exit 1
fi

docker exec "$CONTAINER" \
  sh -c "mc mb --ignore-existing ${ALIAS}/${BUCKET} && echo 'Bucket ${BUCKET} pronto.'"
