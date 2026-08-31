import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const moneyPath = path.join(
  projectRoot,
  'common/common-domain/src/main/java/com/food/ordering/system/domain/valueobject/Money.java',
);
const moneyTestPath = path.join(
  projectRoot,
  'common/common-domain/src/test/java/com/food/ordering/system/domain/valueobject/MoneyTest.java',
);

test('@spec:AC-006 dinheiro normaliza escala, rejeita nulo e preserva invariantes nas opera\u00e7\u00f5es', async () => {
  const [moneySource, moneyTestSource] = await Promise.all([
    readFile(moneyPath, 'utf8'),
    readFile(moneyTestPath, 'utf8'),
  ]);

  assert.match(moneySource, /Objects\.requireNonNull\(amount, "amount must not be null"\)/);
  assert.match(moneySource, /this\.amount = setScale\(/);
  assert.match(moneySource, /input\.setScale\(2, RoundingMode\.HALF_EVEN\)/);

  for (const testName of [
    'normalizesTheAmountToTwoDecimalPlaces',
    'considersEquivalentAmountsWithDifferentScalesEqual',
    'preservesTwoDecimalPlacesForArithmeticOperations',
    'rejectsNullAmountsImmediately',
  ]) {
    assert.match(moneyTestSource, new RegExp(`void ${testName}\\(\\)`));
  }
});
