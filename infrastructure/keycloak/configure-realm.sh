#!/usr/bin/env bash
set -euo pipefail

: "${KEYCLOAK_URL:?KEYCLOAK_URL must be set}"
: "${KEYCLOAK_ADMIN:?KEYCLOAK_ADMIN must be set}"
: "${KEYCLOAK_ADMIN_PASSWORD:?KEYCLOAK_ADMIN_PASSWORD must be set}"
: "${KEYCLOAK_REALM:?KEYCLOAK_REALM must be set}"
: "${KEYCLOAK_CLIENT_ID:?KEYCLOAK_CLIENT_ID must be set}"
: "${KEYCLOAK_CLIENT_SECRET:?KEYCLOAK_CLIENT_SECRET must be set}"
: "${KEYCLOAK_TEST_USER:?KEYCLOAK_TEST_USER must be set}"
: "${KEYCLOAK_TEST_PASSWORD:?KEYCLOAK_TEST_PASSWORD must be set}"

kcadm=/opt/keycloak/bin/kcadm.sh

for attempt in {1..30}; do
  if "${kcadm}" config credentials \
    --server "${KEYCLOAK_URL}" \
    --realm master \
    --user "${KEYCLOAK_ADMIN}" \
    --password "${KEYCLOAK_ADMIN_PASSWORD}" >/dev/null 2>&1; then
    break
  fi

  if [[ "${attempt}" == "30" ]]; then
    echo "Keycloak did not accept administrative credentials in time" >&2
    exit 1
  fi
  sleep 2
done

if ! "${kcadm}" get "realms/${KEYCLOAK_REALM}" >/dev/null 2>&1; then
  "${kcadm}" create realms \
    -s "realm=${KEYCLOAK_REALM}" \
    -s enabled=true \
    -s registrationAllowed=false
fi

client_uuid="$(
  "${kcadm}" get clients \
    -r "${KEYCLOAK_REALM}" \
    -q "clientId=${KEYCLOAK_CLIENT_ID}" \
    --fields id \
    --format csv \
    --noquotes | head -n 1
)"

if [[ -z "${client_uuid}" ]]; then
  client_uuid="$("${kcadm}" create clients \
    -r "${KEYCLOAK_REALM}" \
    -i \
    -s "clientId=${KEYCLOAK_CLIENT_ID}" \
    -s protocol=openid-connect \
    -s enabled=true \
    -s publicClient=false \
    -s standardFlowEnabled=true \
    -s directAccessGrantsEnabled=true \
    -s serviceAccountsEnabled=true \
    -s "secret=${KEYCLOAK_CLIENT_SECRET}")"
else
  "${kcadm}" update "clients/${client_uuid}" \
    -r "${KEYCLOAK_REALM}" \
    -s enabled=true \
    -s publicClient=false \
    -s directAccessGrantsEnabled=true \
    -s "secret=${KEYCLOAK_CLIENT_SECRET}"
fi

find_client_scope_uuid() {
  local expected_scope="$1"
  local candidate_id
  local candidate_name

  while IFS=, read -r candidate_id candidate_name; do
    if [[ "${candidate_name}" == "${expected_scope}" ]]; then
      printf '%s\n' "${candidate_id}"
      return 0
    fi
  done < <(
    "${kcadm}" get client-scopes \
      -r "${KEYCLOAK_REALM}" \
      --fields id,name \
      --format csv \
      --noquotes
  )
}

for scope in customers.write orders.read orders.write; do
  scope_uuid="$(find_client_scope_uuid "${scope}")"

  if [[ -z "${scope_uuid}" ]]; then
    scope_uuid="$("${kcadm}" create client-scopes \
      -r "${KEYCLOAK_REALM}" \
      -i \
      -s "name=${scope}" \
      -s protocol=openid-connect \
      -s 'attributes."include.in.token.scope"=true')"
  fi

  "${kcadm}" update "clients/${client_uuid}/default-client-scopes/${scope_uuid}" \
    -r "${KEYCLOAK_REALM}" \
    -n >/dev/null
done

user_uuid="$(
  "${kcadm}" get users \
    -r "${KEYCLOAK_REALM}" \
    -q "username=${KEYCLOAK_TEST_USER}" \
    --fields id \
    --format csv \
    --noquotes | head -n 1
)"

if [[ -z "${user_uuid}" ]]; then
  user_uuid="$("${kcadm}" create users \
    -r "${KEYCLOAK_REALM}" \
    -i \
    -s "username=${KEYCLOAK_TEST_USER}" \
    -s enabled=true)"
fi

"${kcadm}" update "users/${user_uuid}" \
  -r "${KEYCLOAK_REALM}" \
  -s enabled=true \
  -s firstName=E2E \
  -s lastName=User \
  -s "email=${KEYCLOAK_TEST_USER}@example.test" \
  -s emailVerified=true \
  -s 'requiredActions=[]'

"${kcadm}" set-password \
  -r "${KEYCLOAK_REALM}" \
  --username "${KEYCLOAK_TEST_USER}" \
  --new-password "${KEYCLOAK_TEST_PASSWORD}"

echo "Keycloak realm ${KEYCLOAK_REALM} is configured"
