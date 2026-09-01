import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readRepositoryFile(relativePath) {
  return readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

const profiles = () => readRepositoryFile('performance/k6/profiles.js');
const flow = () => readRepositoryFile('performance/k6/order-flow.js');

test('@spec:AC-013 smoke exercita 5 VUs por 30 s e aplica os limites HTTP', () => {
  const source = profiles();
  assert.match(source, /smoke:\s*\{[\s\S]*?executor: 'constant-vus',[\s\S]*?vus: 5,[\s\S]*?duration: '30s'/);
  assert.match(source, /http_req_failed: \['rate<0\.01'\]/);
  assert.match(source, /http_req_duration: \['p\(95\)<750'\]/);
  assert.match(source, /smoke:[\s\S]*?\.\.\.sagaThreshold/);
  assert.match(flow(), /createOrder\(/);
  assert.match(flow(), /trackOrder\(/);
  assert.match(flow(), /JSON\.parse\(open\('\.\/data\/orders\.json'\)\)/);
  const orderClient = readRepositoryFile('performance/k6/lib/orders.js');
  assert.match(orderClient, /Date\.now\(\) \+ 30_000/);
  assert.match(orderClient, /http\.expectedStatuses\(200, 400\)/);
});

test('@spec:AC-014 carga cresce de 10 para 50 VUs, sustenta por 2 min e mede sagas', () => {
  const source = profiles();
  assert.match(source, /load:\s*\{[\s\S]*?startVUs: 10,[\s\S]*?duration: '5m', target: 50[\s\S]*?duration: '2m', target: 50/);
  assert.match(source, /saga_completion_within_60s: \['rate>0\.95'\]/);
  assert.match(flow(), /sagaTimeoutSeconds = 60/);
  assert.match(flow(), /sagaCompletionWithinSixtySeconds\.add\(true\)/);
  assert.match(flow(), /sagaCompletionWithinSixtySeconds\.add\(false\)/);
});

test('@spec:AC-015 estresse cresce de 50 para 150 VUs, valida preflight e persiste artefatos', () => {
  const source = profiles();
  assert.match(source, /stress:\s*\{[\s\S]*?startVUs: 50,[\s\S]*?duration: '6m', target: 150[\s\S]*?duration: '1m', target: 150/);

  for (const script of ['scripts/run-performance.sh', 'scripts/run-performance.ps1']) {
    const scriptSource = readRepositoryFile(script);
    assert.match(scriptSource, /docker (info|network inspect)|docker network inspect/);
    assert.match(scriptSource, /food-ordering-system_food-ordering-system/);
    assert.match(scriptSource, /K6_DOCKER_NETWORK/);
    assert.match(scriptSource, /health|Healthy/);
    assert.match(scriptSource, /port|Port/);
    assert.match(scriptSource, /memory|Memory/i);
    assert.match(scriptSource, /disk|Disk/i);
    assert.match(scriptSource, /grafana\/k6:0\.54\.0/);
    assert.match(scriptSource, /--summary-export/);
    assert.match(scriptSource, /json=.*report|report\.json/);
    assert.match(scriptSource, /KEYCLOAK_TEST_USER/);
    assert.match(scriptSource, /payment\.credit_entry/);
    assert.match(scriptSource, /payment\.credit_history/);
    assert.match(scriptSource, /150/);
  }

  const auth = readRepositoryFile('performance/k6/lib/auth.js');
  assert.match(auth, /KEYCLOAK_CLIENT_SECRET/);
  assert.doesNotMatch(auth, /console\.(?:log|error).*KEYCLOAK_CLIENT_SECRET/);
  assert.match(flow(), /virtualUserCustomer\(/);
  assert.match(flow(), /const suffix = `\$\{runId\}\$\{__VU\.toString\(16\)\.padStart\(4, '0'\)\}`/);
  assert.match(flow(), /customerId: `00000000-0000-4000-8000-\$\{suffix\}`/);
});
