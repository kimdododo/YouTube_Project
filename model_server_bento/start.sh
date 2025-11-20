#!/bin/bash
set -euo pipefail

PORT_VALUE="${PORT:-8080}"
echo "[Bento] Starting SimCSE service on port ${PORT_VALUE}"
exec bentoml serve service:svc --host=0.0.0.0 --port="${PORT_VALUE}"


