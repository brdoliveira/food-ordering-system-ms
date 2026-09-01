import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(projectRoot, file), 'utf8');

test('@spec:AC-018 runbook documenta stack, autenticação, observabilidade, E2E, desempenho, máquina, CI e GHCR', () => {
  const readme = read('README.md');
  const env = read('.env.example');

  for (const topic of [
    'Stack e pré-requisitos',
    'Autenticação Keycloak local',
    'Observabilidade e diagnóstico',
    'Testes',
    'Smoke, carga e estresse',
    'CI e publicação GHCR',
  ]) {
    assert.match(readme, new RegExp(`## ${topic}`), `tópico ausente: ${topic}`);
  }

  for (const composeFile of [
    'common.yml', 'zookeeper.yml', 'kafka_cluster.yml', 'init_kafka.yml', 'keycloak.yml', 'services.yml',
  ]) {
    assert.match(readme, new RegExp(`infrastructure/docker-compose/${composeFile.replace('.', '\\.')}`));
  }
  assert.match(readme, /up --build --wait/);
  assert.match(readme, /down --volumes --remove-orphans/);
  assert.match(readme, /GHCR_OWNER/);
  assert.match(readme, /IMAGE_TAG/);

  for (const value of [
    'KEYCLOAK_REALM=food-ordering', 'KEYCLOAK_CLIENT_ID=food-ordering-client',
    'KEYCLOAK_CLIENT_SECRET=', 'KEYCLOAK_TEST_USER=', 'KEYCLOAK_TEST_PASSWORD=',
  ]) assert.match(env, new RegExp(`^${value}`, 'm'));
  assert.match(readme, /protocol\/openid-connect\/token/);
  assert.match(readme, /Host: keycloak:8080/);
  assert.match(readme, /mesmo issuer interno/);
  for (const scope of ['customers.write', 'orders.write', 'orders.read']) assert.match(readme, new RegExp(scope.replace('.', '\\.')));
  assert.match(readme, /sem JWT.*JWT inválido.*sem escopo/);

  for (const signal of ['/actuator/health', '/actuator/health/liveness', '/actuator/health/readiness', '/actuator/prometheus', 'trace_id', 'span_id', 'traceId', 'spanId']) {
    assert.match(readme, new RegExp(signal.replace(/[/.]/g, '\\$&')));
  }
  assert.match(readme, /Authorization.*tokens.*senhas.*client secrets/);

  assert.match(readme, /quality-tests\/end-to-end\.test\.mjs/);
  assert.match(readme, /sobe e encerra sua própria stack isolada/);
  assert.match(readme, /APPROVED/);
  assert.match(readme, /CANCELLED/);
  assert.match(readme, /60 segundos/);
  for (const profile of ['smoke', 'load', 'stress']) assert.match(readme, new RegExp(`run-performance\\.(?:sh|ps1).*${profile}`));
  assert.match(readme, /5 VUs.*30 s/);
  assert.match(readme, /10 para 50 VUs.*5 min.*2 min/);
  assert.match(readme, /50 para 150 VUs.*6 min.*1 min/);
  assert.match(readme, /4 GB.*2 GB.*5 GB.*8 GB.*10 GB/);
  assert.match(readme, /ci\.yml/);
  assert.match(readme, /performance\.yml/);
  assert.match(readme, /publish-images\.yml/);
  assert.match(readme, /GITHUB_TOKEN/);
  assert.match(readme, /packages: write/);
  assert.match(readme, /sha-/);
  assert.match(readme, /main.*versão/);

  assert.doesNotMatch(env, /ghp_|github_pat_|AKIA[0-9A-Z]{16}/i);
  assert.doesNotMatch(readme, /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/);
});
