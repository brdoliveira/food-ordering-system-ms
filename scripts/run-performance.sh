#!/usr/bin/env bash
set -euo pipefail

profile="${1:-smoke}"
case "${profile}" in
  smoke|load|stress) ;;
  *) echo "Usage: $0 [smoke|load|stress] [results-directory]" >&2; exit 64 ;;
esac

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
results_directory="${2:-${project_root}/performance/results}"
printf -v run_id '%08x' "$(date +%s)"
docker_network="${K6_DOCKER_NETWORK:-food-ordering-system_food-ordering-system}"

require_command() {
  command -v "$1" >/dev/null 2>&1 || { echo "Preflight failed: $1 is required." >&2; exit 1; }
}

require_command docker
docker info >/dev/null
docker network inspect "${docker_network}" >/dev/null 2>&1 || {
  echo "Preflight failed: Docker network ${docker_network} is unavailable." >&2
  exit 1
}

minimum_memory_bytes=$((4 * 1024 * 1024 * 1024))
minimum_disk_kilobytes=$((2 * 1024 * 1024))
if [[ "${profile}" == "load" ]]; then
  minimum_disk_kilobytes=$((5 * 1024 * 1024))
elif [[ "${profile}" == "stress" ]]; then
  minimum_memory_bytes=$((8 * 1024 * 1024 * 1024))
  minimum_disk_kilobytes=$((10 * 1024 * 1024))
fi

available_memory="$(docker info --format '{{.MemTotal}}')"
available_disk="$(df -Pk "${project_root}" | awk 'NR == 2 { print $4 }')"
[[ "${available_memory}" =~ ^[0-9]+$ && "${available_memory}" -ge "${minimum_memory_bytes}" ]] || {
  echo "Preflight failed: Docker memory is below the minimum for ${profile}." >&2
  exit 1
}
[[ "${available_disk}" =~ ^[0-9]+$ && "${available_disk}" -ge "${minimum_disk_kilobytes}" ]] || {
  echo "Preflight failed: free disk space is below the minimum for ${profile}." >&2
  exit 1
}

for required_service in keycloak:8080 customer-service:8184 order-service:8181; do
  service="${required_service%%:*}"
  service_port="${required_service##*:}"
  container_id="$(docker ps --filter "label=com.docker.compose.service=${service}" --format '{{.ID}}' | head -n 1)"
  [[ -n "${container_id}" ]] || { echo "Preflight failed: ${service} is not running." >&2; exit 1; }
  health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container_id}")"
  [[ "${health}" == "healthy" ]] || { echo "Preflight failed: ${service} is ${health}, not healthy." >&2; exit 1; }
  published_port="$(docker port "${container_id}" "${service_port}/tcp" 2>/dev/null | head -n 1)"
  [[ -n "${published_port}" ]] || { echo "Preflight failed: ${service} port ${service_port} is not published." >&2; exit 1; }
done

: "${KEYCLOAK_CLIENT_SECRET:?Preflight failed: KEYCLOAK_CLIENT_SECRET must be set}"
: "${KEYCLOAK_TEST_PASSWORD:?Preflight failed: KEYCLOAK_TEST_PASSWORD must be set}"
: "${KEYCLOAK_TEST_USER:?Preflight failed: KEYCLOAK_TEST_USER must be set}"

postgres_container_id="$(docker ps --filter 'label=com.docker.compose.service=postgres' --format '{{.ID}}' | head -n 1)"
[[ -n "${postgres_container_id}" ]] || { echo 'Preflight failed: postgres is not running.' >&2; exit 1; }
database_user="${POSTGRES_USER:-postgres}"
credit_entries=''
credit_histories=''
separator=''
for virtual_user in $(seq 1 150); do
  printf -v virtual_user_hex '%04x' "${virtual_user}"
  customer_id="00000000-0000-4000-8000-${run_id}${virtual_user_hex}"
  credit_entries+="${separator}('10000000-0000-4000-8000-${run_id}${virtual_user_hex}', '${customer_id}', 100000.00)"
  credit_histories+="${separator}('20000000-0000-4000-8000-${run_id}${virtual_user_hex}', '${customer_id}', 100000.00, 'CREDIT')"
  separator=','
done
{
  printf 'INSERT INTO payment.credit_entry(id, customer_id, total_credit_amount) VALUES %s ON CONFLICT (id) DO UPDATE SET total_credit_amount = EXCLUDED.total_credit_amount;\n' "${credit_entries}"
  printf 'INSERT INTO payment.credit_history(id, customer_id, amount, type) VALUES %s ON CONFLICT (id) DO NOTHING;\n' "${credit_histories}"
} | docker exec -i "${postgres_container_id}" psql -v ON_ERROR_STOP=1 -U "${database_user}"

mkdir -p "${results_directory}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
summary="/results/${profile}-${timestamp}-summary.json"
report="/results/${profile}-${timestamp}-report.json"

docker run --rm \
  --network "${docker_network}" \
  --mount "type=bind,source=${project_root}/performance/k6,target=/scripts,readonly" \
  --mount "type=bind,source=$(cd "${results_directory}" && pwd),target=/results" \
  --env "K6_PROFILE=${profile}" \
  --env "K6_RUN_ID=${run_id}" \
  --env KEYCLOAK_CLIENT_SECRET \
  --env KEYCLOAK_TEST_PASSWORD \
  --env KEYCLOAK_TEST_USER \
  --env KEYCLOAK_REALM \
  --env KEYCLOAK_CLIENT_ID \
  grafana/k6:0.54.0 run /scripts/order-flow.js \
  --summary-export "${summary}" \
  --out "json=${report}"

echo "Performance artifacts saved in ${results_directory}."
