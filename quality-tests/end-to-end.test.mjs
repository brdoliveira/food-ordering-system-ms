import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let runtimeVerificationAttempted = false;
let runtimeVerificationFailure;

function readRepositoryFile(relativePath) {
  return readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

function verifyRuntimeOnce() {
  if (!runtimeVerificationAttempted) {
    runtimeVerificationAttempted = true;
    const wrapper = process.platform === 'win32' ? 'mvnw.cmd' : './mvnw';
    try {
      execFileSync(wrapper, ['--batch-mode', '-pl', 'integration-tests', 'verify'], {
        cwd: projectRoot,
        shell: process.platform === 'win32',
        stdio: 'inherit',
        timeout: 30 * 60 * 1000,
      });
    } catch (failure) {
      runtimeVerificationFailure = failure;
    }
  }
  if (runtimeVerificationFailure) throw runtimeVerificationFailure;
}

test('T-010 usa uma stack Compose hermética e autenticação real', () => {
  const rootPom = readRepositoryFile('pom.xml');
  const integrationPom = readRepositoryFile('integration-tests/pom.xml');
  const environment = readRepositoryFile(
    'integration-tests/src/test/java/com/food/ordering/system/e2e/support/StackEnvironment.java',
  );
  const configuration = readRepositoryFile('integration-tests/src/test/resources/application-test.yml');

  assert.match(rootPom, /<module>integration-tests<\/module>/);
  assert.match(integrationPom, /<artifactId>testcontainers<\/artifactId>/);
  assert.match(integrationPom, /<artifactId>maven-failsafe-plugin<\/artifactId>/);
  assert.match(integrationPom, /<goal>integration-test<\/goal>/);
  assert.match(integrationPom, /<goal>verify<\/goal>/);

  assert.match(environment, /new ComposeContainer\(/);
  assert.match(environment, /\.withLocalCompose\(true\)/);
  assert.match(environment, /\.withBuild\(true\)/);
  assert.match(environment, /\.withRemoveVolumes\(true\)/);
  assert.match(environment, /ports: !reset \[\]/);
  assert.match(environment, /KEYCLOAK_CLIENT_SECRET/);
  assert.match(environment, /KEYCLOAK_TEST_PASSWORD/);
  assert.match(environment, /getContainerByServiceName/);
  assert.doesNotMatch(configuration, /(?:password|secret):\s+(?!\$\{)/i);
});

test('T-010 preserva os dois critérios como testes E2E reais de até 60 segundos', () => {
  const flow = readRepositoryFile(
    'integration-tests/src/test/java/com/food/ordering/system/e2e/FullOrderFlowIT.java',
  );
  const environment = readRepositoryFile(
    'integration-tests/src/test/java/com/food/ordering/system/e2e/support/StackEnvironment.java',
  );
  const configuration = readRepositoryFile('integration-tests/src/test/resources/application-test.yml');

  assert.match(flow, /@DisplayName\("@spec:AC-011[^"\n]+APPROVED[^"\n]+60 s"\)/);
  assert.match(flow, /@DisplayName\("@spec:AC-012[^"\n]+CANCELLED[^"\n]+60 s"\)/);
  assert.match(flow, /grant_type/);
  assert.match(flow, /Bearer /);
  assert.match(environment, /\/protocol\/openid-connect\/token/);
  assert.match(flow, /createCustomer\(/);
  assert.match(flow, /createOrderWhenCustomerProjectionIsReady\(/);
  assert.match(flow, /awaitTerminalStatus\(/);
  assert.match(configuration, /^\s+saga-timeout-seconds: 60$/m);

  assert.doesNotMatch(flow, /@Disabled|Assumptions\.|\.skip\(|\.todo\(/);
  assert.doesNotMatch(flow, /Mock|Mockito|WireMock|MockWebServer/);

  for (const schema of [
    'customer-service/customer-container/src/main/resources/init-schema.sql',
    'order-service/order-container/src/main/resources/init-schema.sql',
    'payment-service/payment-container/src/main/resources/init-schema.sql',
    'restaurant-service/restaurant-container/src/main/resources/init-schema.sql',
  ]) {
    const sql = readRepositoryFile(schema);
    assert.match(sql, /pg_advisory_lock\(hashtext\('food-ordering\.uuid-ossp'\)\)/);
    assert.match(sql, /pg_advisory_unlock\(hashtext\('food-ordering\.uuid-ossp'\)\)/);
  }
});

test('@spec:AC-011 pedido válido termina APPROVED em até 60 s na stack real', {
  timeout: 31 * 60 * 1000,
}, verifyRuntimeOnce);

test('@spec:AC-012 crédito insuficiente termina CANCELLED em até 60 s na stack real', {
  timeout: 31 * 60 * 1000,
}, verifyRuntimeOnce);
