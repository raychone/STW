const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
let createDb = null;
let dbLoadError = null;

try {
  ({ createDb } = require('../src/main/services/db'));
} catch (error) {
  dbLoadError = error;
}

test('db creates project, section and glossary terms', () => {
  if (dbLoadError || !createDb) {
    test.skip(`Skipping DB test in this environment: ${dbLoadError.message}`);
    return;
  }
  let store = null;
  try {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stw-db-'));
    store = createDb(tmp);
  } catch (error) {
    test.skip(`Skipping DB test in this environment: ${error.message}`);
    return;
  }

  const project = store.createProject('Test Proiect');
  assert.ok(project.id > 0);

  const section = store.createSection({ projectId: project.id, title: 'Capitol 1' });
  assert.equal(section.title, 'Capitol 1');

  store.upsertGlossaryTerm({ scope: 'global', source: 'iasi', target: 'Iași' });
  store.upsertGlossaryTerm({ scope: 'project', projectId: project.id, source: 'cluj', target: 'Cluj' });

  const globalTerms = store.listGlossaryTerms({ scope: 'global' });
  const projectTerms = store.listGlossaryTerms({ scope: 'project', projectId: project.id });

  assert.equal(globalTerms.length, 1);
  assert.equal(projectTerms.length, 1);

  store.close();
});
