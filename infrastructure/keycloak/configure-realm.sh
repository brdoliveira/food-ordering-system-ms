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
  "${kcadm}" create clients \
    -r "${KEYCLOAK_REALM}" \
    -s "clientId=${KEYCLOAK_CLIENT_ID}" \
    -s enabled=true \
    -s publicClient=false \
    -s standardFlowEnabled=true \
    -s directAccessGrantsEnabled=true \
    -s serviceAccountsEnabled=true \
    -s "secret=${KEYCLOAK_CLIENT_SECRET}"
  client_uuid="$(
    "${kcadm}" get clients \
      -r "${KEYCLOAK_REALM}" \
      -q "clientId=${KEYCLOAK_CLIENT_ID}" \
      --fields id \
      --format csv \
      --noquotes | head -n 1
  )"
else
  "${kcadm}" update "clients/${client_uuid}" \
    -r "${KEYCLOAK_REALM}" \
    -s enabled=true \
    -s publicClient=false \
    -s directAccessGrantsEnabled=true \
    -s "secret=${KEYCLOAK_CLIENT_SECRET}"
fi

for scope in customers:write orders:read orders:write; do
  scope_uuid="$(
    "${kcadm}" get client-scopes \
      -r "${KEYCLOAK_REALM}" \
      -q "name=${scope}" \
      --fields id \
      --format csv \
      --noquotes | head -n 1
  )"

  if [[ -z "${scope_uuid}" ]]; then
    "${kcadm}" create client-scopes \
      -r "${KEYCLOAK_REALM}" \
      -s "name=${scope}" \
      -s protocol=openid-connect \
      -s 'attributes."include.in.token.scope"=true'
    scope_uuid="$(
      "${kcadm}" get client-scopes \
        -r "${KEYCLOAK_REALM}" \
        -q "name=${scope}" \
        --fields id \
        --format csv \
        --noquotes | head -n 1
    )"
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
  "${kcadm}" create users \
    -r "${KEYCLOAK_REALM}" \
    -s "username=${KEYCLOAK_TEST_USER}" \
    -s enabled=true
fi

"${kcadm}" set-password \
  -r "${KEYCLOAK_REALM}" \
  --username "${KEYCLOAK_TEST_USER}" \
  --new-password "${KEYCLOAK_TEST_PASSWORD}"

echo "Keycloak realm ${KEYCLOAK_REALM} is configured"
