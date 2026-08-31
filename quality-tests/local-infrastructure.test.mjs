import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const composeDirectory = path.join(projectRoot, 'infrastructure', 'docker-compose');
const composeFiles = ['common.yml', 'zookeeper.yml', 'kafka_cluster.yml', 'init_kafka.yml'];
const composePaths = composeFiles.map((file) => path.join(composeDirectory, file));

function dockerComposeIsAvailable() {
  const result = spawnSync('docker', ['compose', 'version'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });

  return result.status === 0;
}

test('@spec:AC-005 infraestrutura local combina PostgreSQL, ZooKeeper, trÃªs brokers Kafka e Schema Registry na rede declarada', () => {
  const files = Object.fromEntries(
    composeFiles.map((file, index) => [file, readFileSync(composePaths[index], 'utf8')]),
  );
  const combined = Object.values(files).join('\n');

  assert.match(files['common.yml'], /^networks:\s*\n\s+food-ordering-system:/m);
  assert.match(files['common.yml'], /^\s+postgres:\s*$/m);
  assert.match(files['common.yml'], /image:\s*postgres:/);
  assert.match(files['common.yml'], /healthcheck:\s*\n\s+test:/);
  assert.match(files['zookeeper.yml'], /^\s+zookeeper:\s*$/m);
  assert.match(files['kafka_cluster.yml'], /^\s+schema-registry:\s*$/m);

  for (const broker of ['kafka-broker-1', 'kafka-broker-2', 'kafka-broker-3']) {
    assert.match(files['kafka_cluster.yml'], new RegExp(`^\\s+${broker}:\\s*$`, 'm'));
  }

  assert.doesNotMatch(combined, /\$\{GLOBAL_NETWORK:-kafka\}/);
  for (const source of Object.values(files)) {
    for (const network of source.matchAll(/^\s+-\s+([^\s#]+)\s*$/gm)) {
      if (network[1] === 'food-ordering-system') {
        continue;
      }
      assert.notEqual(network[1], 'kafka', 'a infraestrutura deve referenciar somente a rede declarada');
    }
  }

  if (dockerComposeIsAvailable()) {
    const argumentsForConfig = composePaths.flatMap((file) => ['-f', file]).concat('config');
    const config = execFileSync('docker', ['compose', ...argumentsForConfig], {
      cwd: projectRoot,
      encoding: 'utf8',
      env: { ...process.env, KAFKA_VERSION: process.env.KAFKA_VERSION ?? '7.6.1' },
    });

    for (const service of ['postgres', 'zookeeper', 'kafka-broker-1', 'kafka-broker-2', 'kafka-broker-3', 'schema-registry']) {
      assert.match(config, new RegExp(`\\n  ${service}:`));
    }
    assert.match(config, /food-ordering-system:/);
  }
});
