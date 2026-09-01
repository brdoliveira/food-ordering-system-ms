import http from 'k6/http';
import { check } from 'k6';

const keycloakBaseUrl = __ENV.KEYCLOAK_BASE_URL || 'http://keycloak:8080';
const realm = __ENV.KEYCLOAK_REALM || 'food-ordering';
const clientId = __ENV.KEYCLOAK_CLIENT_ID || 'food-ordering-client';
const username = __ENV.KEYCLOAK_TEST_USER || 'performance-user';

function requiredEnvironment(name) {
  const value = __ENV[name];
  if (!value) {
    throw new Error(`${name} must be set for the performance test.`);
  }
  return value;
}

export function fetchAccessToken() {
  const form = [
    'grant_type=password',
    `client_id=${encodeURIComponent(clientId)}`,
    `client_secret=${encodeURIComponent(requiredEnvironment('KEYCLOAK_CLIENT_SECRET'))}`,
    `username=${encodeURIComponent(username)}`,
    `password=${encodeURIComponent(requiredEnvironment('KEYCLOAK_TEST_PASSWORD'))}`,
    'scope=openid%20customers.write%20orders.write%20orders.read',
  ].join('&');

  const response = http.post(
    `${keycloakBaseUrl}/realms/${realm}/protocol/openid-connect/token`,
    form,
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, tags: { endpoint: 'token' } },
  );
  const tokenAccepted = check(response, {
    'token endpoint returns 200': (result) => result.status === 200,
  });
  const accessToken = tokenAccepted ? response.json('access_token') : '';
  if (!accessToken) {
    throw new Error('Keycloak did not return an access token.');
  }
  return accessToken;
}
