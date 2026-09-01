import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readRepositoryFile(relativePath) {
  return readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

const composeFiles = [
  'common.yml',
  'zookeeper.yml',
  'kafka_cluster.yml',
  'init_kafka.yml',
  'keycloak.yml',
  'services.yml',
];

function assertUsesCompleteStack(workflow) {
  for (const composeFile of composeFiles) {
    assert.match(workflow, new RegExp(`-f infrastructure/docker-compose/${composeFile.replace('.', '\\.')}`));
  }
}

test('@spec:AC-016 CI executa build, testes e smoke nas mudanças comuns; carga e estresse ficam agendados ou manuais', () => {
  const ci = readRepositoryFile('.github/workflows/ci.yml');
  const performance = readRepositoryFile('.github/workflows/performance.yml');

  assert.match(ci, /push:\s*\n\s+branches: \[main\]/);
  assert.match(ci, /pull_request:/);
  assert.match(ci, /permissions:\s*\n\s+contents: read/);
  assert.doesNotMatch(ci, /packages: write/);
  assert.match(ci, /\.\/mvnw --batch-mode test/);
  assert.match(ci, /actions\/setup-node@v4/);
  assert.match(ci, /node --test quality-tests\/\*\.test\.mjs/);
  assert.match(ci, /\.\/scripts\/run-performance\.sh smoke performance\/results/);
  assert.match(ci, /actions\/upload-artifact@v4/);
  assertUsesCompleteStack(ci);

  assert.match(performance, /schedule:/);
  assert.match(performance, /workflow_dispatch:/);
  assert.doesNotMatch(performance, /^\s*(?:push|pull_request):/m);
  assert.match(performance, /permissions:\s*\n\s+contents: read/);
  assert.doesNotMatch(performance, /packages: write/);
  assert.match(performance, /profile: \[load, stress\]/);
  assert.match(performance, /\.\/scripts\/run-performance\.sh \$\{\{ matrix\.profile \}\} performance\/results/);
  assert.match(performance, /if: always\(\)/);
  assert.match(performance, /actions\/upload-artifact@v4/);
  assert.match(performance, /performance\/results\/\$\{\{ matrix\.profile \}\}-\*\.json/);
  assertUsesCompleteStack(performance);
});

test('@spec:AC-017 publica os quatro serviços no GHCR com SHA imutável e canais ou versões apropriados', () => {
  const workflow = readRepositoryFile('.github/workflows/publish-images.yml');

  assert.match(workflow, /push:\s*\n\s+branches: \[main\]\s*\n\s+tags: \['v\*'\]/);
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /packages: write/);
  assert.doesNotMatch(workflow, /contents: write|actions: write|id-token: write/);
  assert.match(workflow, /docker\/login-action@v3/);
  assert.match(workflow, /registry: ghcr\.io/);
  assert.match(workflow, /password: \$\{\{ secrets\.GITHUB_TOKEN \}\}/);
  assert.match(workflow, /docker\/metadata-action@v5/);
  assert.match(workflow, /type=sha,format=long,prefix=sha-/);
  assert.match(workflow, /type=raw,value=main,enable=\$\{\{ github\.ref == 'refs\/heads\/main' \}\}/);
  assert.match(workflow, /type=ref,event=tag/);
  assert.match(workflow, /docker\/build-push-action@v6/);
  assert.match(workflow, /push: true/);

  for (const service of ['customer', 'order', 'payment', 'restaurant']) {
    assert.match(workflow, new RegExp(`- image: ${service}`));
    assert.match(workflow, new RegExp(`food-ordering-\\$\\{\\{ matrix\\.image \\}\\}`));
  }
});
