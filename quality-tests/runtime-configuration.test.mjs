import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const services = [
  ['customer', 'customer-service/customer-container/src/main/resources/application.yml'],
  ['order', 'order-service/order-container/src/main/resources/application.yml'],
  ['payment', 'payment-service/payment-container/src/main/resources/application.yml'],
  ['restaurant', 'restaurant-service/restaurant-container/src/main/resources/application.yml'],
];

test('@spec:AC-004 serviços aceitam configuração de banco e Kafka por ambiente', async () => {
  const expectedPlaceholders = [
    '${DB_URL:jdbc:postgresql://localhost:5432/postgres?',
    '${DB_USERNAME:postgres}',
    '${DB_PASSWORD:admin}',
    '${KAFKA_BOOTSTRAP_SERVERS:localhost:19092,localhost:29092,localhost:39092}',
    '${KAFKA_SCHEMA_REGISTRY_URL:http://localhost:8081}',
  ];

  for (const [name, relativePath] of services) {
    const configuration = await readFile(path.join(projectRoot, relativePath), 'utf8');
    for (const placeholder of expectedPlaceholders) {
      assert.ok(configuration.includes(placeholder), `${name} must contain ${placeholder}`);
    }
  }

  const environmentExample = await readFile(path.join(projectRoot, '.env.example'), 'utf8');
  for (const variableName of ['DB_URL', 'DB_USERNAME', 'DB_PASSWORD', 'KAFKA_BOOTSTRAP_SERVERS', 'KAFKA_SCHEMA_REGISTRY_URL']) {
    assert.match(environmentExample, new RegExp(`^${variableName}=`, 'm'));
  }
});
