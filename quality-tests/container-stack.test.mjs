import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const composeDirectory = path.join(projectRoot, 'infrastructure', 'docker-compose');
const composeFiles = [
  'common.yml',
  'zookeeper.yml',
  'kafka_cluster.yml',
  'init_kafka.yml',
  'keycloak.yml',
  'services.yml',
];
const composePaths = composeFiles.map((file) => path.join(composeDirectory, file));
const applicationServices = ['customer-service', 'order-service', 'payment-service', 'restaurant-service'];
const infrastructureServices = [
  'postgres',
  'zookeeper',
  'kafka-broker-1',
  'kafka-broker-2',
  'kafka-broker-3',
  'schema-registry',
  'keycloak',
];
const containerPoms = [
  'customer-service/customer-container/pom.xml',
  'order-service/order-container/pom.xml',
  'payment-service/payment-container/pom.xml',
  'restaurant-service/restaurant-container/pom.xml',
];

function readRepositoryFile(relativePath) {
  return readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

function dockerComposeIsAvailable() {
  return spawnSync('docker', ['compose', 'version'], { cwd: projectRoot }).status === 0;
}

test('@spec:AC-008 stack completa fica pronta por um único comando Compose', () => {
  const composeSources = composeFiles.map((file) => readRepositoryFile(`infrastructure/docker-compose/${file}`));
  const combinedSource = composeSources.join('\n');

  assert.doesNotMatch(combinedSource, /^version:/m, 'Compose não deve usar o atributo version obsoleto');
  for (const service of [...infrastructureServices, ...applicationServices]) {
    assert.match(combinedSource, new RegExp(`^  ${service}:\\s*$`, 'm'), `serviço ausente: ${service}`);
  }
  assert.match(combinedSource, /^networks:\s*\n  food-ordering-system:/m);
  assert.match(readRepositoryFile('infrastructure/docker-compose/keycloak.yml'), /configure-realm\.sh/);

  if (!dockerComposeIsAvailable()) return;

  const configArguments = composePaths
    .flatMap((file) => ['-f', file])
    .concat(['config', '--format', 'json']);
  const config = JSON.parse(execFileSync('docker', ['compose', ...configArguments], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      GHCR_OWNER: 'spec-test',
      IMAGE_TAG: '0123456789abcdef0123456789abcdef01234567',
      POSTGRES_PASSWORD: 'spec-test-postgres',
      KEYCLOAK_ADMIN: 'spec-admin',
      KEYCLOAK_ADMIN_PASSWORD: 'spec-test-admin',
      KEYCLOAK_CLIENT_SECRET: 'spec-test-client',
      KEYCLOAK_TEST_USER: 'spec-user',
      KEYCLOAK_TEST_PASSWORD: 'spec-test-user',
    },
  }));

  for (const serviceName of [...infrastructureServices, ...applicationServices]) {
    const service = config.services[serviceName];
    assert.ok(service, `configuração combinada deve conter ${serviceName}`);
    assert.ok(
      Object.hasOwn(service.networks, 'food-ordering-system'),
      `${serviceName} deve usar a rede única`,
    );
    assert.ok(service.healthcheck?.test, `${serviceName} deve declarar healthcheck`);
  }

  for (const serviceName of applicationServices) {
    const service = config.services[serviceName];
    const dependencies = service.depends_on;
    assert.equal(dependencies.postgres.condition, 'service_healthy');
    assert.equal(dependencies['schema-registry'].condition, 'service_healthy');
    assert.equal(dependencies['init-kafka'].condition, 'service_completed_successfully');
    assert.equal(dependencies['keycloak-config'].condition, 'service_completed_successfully');
    assert.match(service.healthcheck.test.join(' '), /SERVER_PORT/);
    assert.ok(service.ports?.length, `${serviceName} deve publicar sua porta HTTP`);
  }
});

test('@spec:AC-017 imagens imutáveis dos quatro serviços estão prontas para publicação no GHCR', () => {
  const dockerfile = readRepositoryFile('Dockerfile');
  const servicesCompose = readRepositoryFile('infrastructure/docker-compose/services.yml');

  assert.match(dockerfile, /^FROM .+ AS build$/m);
  assert.match(dockerfile, /^ARG SERVICE_MODULE$/m);
  assert.match(dockerfile, /^USER app:app$/m);
  assert.match(dockerfile, /^HEALTHCHECK /m);
  assert.match(dockerfile, /org\.opencontainers\.image\.revision="\$\{BUILD_REVISION\}"/);
  assert.doesNotMatch(dockerfile, /:latest(?:\s|$)/);

  for (const pomPath of containerPoms) {
    const pom = readRepositoryFile(pomPath);
    assert.match(pom, /<artifactId>spring-boot-starter-web<\/artifactId>/);
    assert.match(pom, /<artifactId>spring-boot-starter-actuator<\/artifactId>/);
    assert.match(pom, /<artifactId>spring-boot-maven-plugin<\/artifactId>/);
  }

  for (const serviceName of applicationServices) {
    const imageName = serviceName.replace('-service', '');
    assert.match(
      servicesCompose,
      new RegExp(`image: ghcr\\.io/\\$\\{GHCR_OWNER:\\?[^}]+}/food-ordering-${imageName}:\\$\\{IMAGE_TAG:\\?[^}]+}`),
    );
  }
  assert.doesNotMatch(servicesCompose, /:latest(?:\s|$)/);
});
