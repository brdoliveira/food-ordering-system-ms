import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const repositoryRoot = join(import.meta.dirname, '..');

function readRepositoryFile(path) {
  return readFileSync(join(repositoryRoot, path), 'utf8');
}

test('@spec:AC-001 build completo funciona pelo Maven Wrapper', () => {
  const wrapper = process.platform === 'win32' ? 'mvnw.cmd' : './mvnw';
  const wrapperProperties = readRepositoryFile('.mvn/wrapper/maven-wrapper.properties');

  assert.ok(existsSync(join(repositoryRoot, 'mvnw')));
  assert.ok(existsSync(join(repositoryRoot, 'mvnw.cmd')));
  assert.match(wrapperProperties, /^distributionUrl=https:\/\/repo\.maven\.apache\.org\/maven2\/org\/apache\/maven\/apache-maven\/3\.9\.9\/apache-maven-3\.9\.9-bin\.zip$/m);

  execFileSync(wrapper, ['--batch-mode', 'test'], {
    cwd: repositoryRoot,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });
});

test('@spec:AC-002 integra\u00e7\u00e3o cont\u00ednua valida cada mudan\u00e7a', () => {
  const workflow = readRepositoryFile('.github/workflows/ci.yml');

  assert.match(workflow, /push:\s*\n\s+branches: \[main\]/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /actions\/setup-java@v4/);
  assert.match(workflow, /java-version: '17'/);
  assert.match(workflow, /cache: maven/);
  assert.match(workflow, /\.\/mvnw --batch-mode test/);
});

test('@spec:AC-003 arquivos locais e gerados ficam fora do versionamento', () => {
  const gitignore = readRepositoryFile('.gitignore');

  for (const ignoredPath of [
    '**/target/',
    '.idea/',
    '.vscode/',
    '.env',
    '.env.*',
    'infrastructure/volumes/',
    'infrastructure/**/data/',
  ]) {
    assert.match(gitignore, new RegExp(`^${ignoredPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  }
  assert.match(gitignore, /^!\.env\.example$/m);
});
