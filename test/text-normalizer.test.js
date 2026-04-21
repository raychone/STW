const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeRomanianText } = require('../src/main/lib/text-normalizer');

test('normalizeRomanianText applies punctuation and capitalization', () => {
  const text = normalizeRomanianText(' salut lume ');
  assert.equal(text, 'Salut lume.');
});

test('normalizeRomanianText applies glossary replacements', () => {
  const glossaryMap = new Map([['bucuresti', 'București']]);
  const text = normalizeRomanianText('mergem in bucuresti', { glossaryMap });
  assert.equal(text, 'Mergem in București.');
});
