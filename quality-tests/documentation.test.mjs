import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('@spec:AC-007 README documenta arquitetura, operação, portas e exemplos de API', async () => {
  const readme = await readFile(path.join(projectRoot, 'README.md'), 'utf8');
  for (const term of ['Arquitetura e módulos', 'Pré-requisitos', './mvnw test', './mvnw.cmd test', 'docker compose', 'quality-tests', '8181', '8182', '8183', '8184', 'POST /customers', 'POST /orders', 'GET /orders/{trackingId}', 'json-files/customer.json', 'json-files/order.json']) assert.ok(readme.includes(term), `README deve conter: ${term}`);
});
